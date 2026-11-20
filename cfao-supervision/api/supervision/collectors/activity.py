"""Connexions des utilisateurs : qui a utilisé quel module, et quand.

Deux sources, aucune adresse IP conservée :
  - journaux de la passerelle (toutes les 30 s) : une requête réussie portant un
    jeton d'utilisateur (`sub`, client `azp` d'une application) = activité ;
  - journal des connexions Keycloak (toutes les 60 s) : événement LOGIN = connexion,
    et nom lisible du compte.
Toute mise à jour garde la date la plus récente : rejouer une période n'a aucun effet.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timedelta, timezone

import requests
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone as djtz

from ..models import CollectRun, KnownUser, Module, UserModuleAccess
from . import docker_client

TIMEOUT_S = 10
PAGE = 100
FIRST_LOOKBACK_S = 3600


# ── Correspondances ──

def _active_first(modules: list[Module]) -> list[Module]:
    active = set(settings.SUPERVISION_PROJECTS)
    return sorted(modules, key=lambda m: (m.project not in active, m.sort_order))


def edge_module_map() -> dict[str, Module]:
    mapping: dict[str, Module] = {}
    for module in _active_first(list(Module.objects.all())):
        for tag in module.edge_modules or []:
            mapping.setdefault(tag, module)
    return mapping


def client_module_map() -> dict[str, Module]:
    mapping: dict[str, Module] = {}
    for module in _active_first(list(Module.objects.all())):
        for client in module.oidc_clients or []:
            mapping.setdefault(client, module)
    return mapping


def _record(hits: dict[tuple[str, int], datetime], field: str, modules: dict[int, Module],
            usernames: dict[str, str] | None = None) -> int:
    """Écrit les dates les plus récentes ; renvoie le nombre de lignes modifiées."""
    usernames = usernames or {}
    written = 0
    with transaction.atomic():
        for (subject, module_id), at in hits.items():
            user, _ = KnownUser.objects.get_or_create(subject=subject)
            dirty = []
            if usernames.get(subject) and user.username != usernames[subject]:
                user.username = usernames[subject][:150]
                dirty.append("username")
            if user.last_seen_at is None or at > user.last_seen_at:
                user.last_seen_at = at
                dirty.append("last_seen_at")
            if dirty:
                user.save(update_fields=dirty)
            if module_id is None:
                continue
            access, _ = UserModuleAccess.objects.get_or_create(user=user, module=modules[module_id])
            current = getattr(access, field)
            if current is None or at > current:
                setattr(access, field, at)
                access.save(update_fields=[field])
                written += 1
    return written


def _run(source: str) -> CollectRun:
    run, _ = CollectRun.objects.get_or_create(source=source)
    return run


# ── Journaux de la passerelle ──

def parse_edge_line(line: str, edge_map: dict[str, Module], user_clients: set[str]):
    """(subject, module, date) pour une requête d'utilisateur réussie, sinon None."""
    line = line.strip()
    if not line.startswith("{"):
        return None
    try:
        entry = json.loads(line)
    except ValueError:
        return None
    subject = entry.get("sub") or ""
    if not subject or entry.get("module") not in edge_map:
        return None
    status = entry.get("status")
    if not isinstance(status, int) or status >= 400:
        return None
    # Un jeton de service (client technique) n'est pas un utilisateur.
    azp = entry.get("azp")
    if azp is not None and azp not in user_clients:
        return None
    try:
        at = datetime.fromisoformat(entry.get("time", ""))
    except ValueError:
        return None
    return subject, edge_map[entry["module"]], at


def collect_edge(now_s: float | None = None) -> dict:
    now_s = now_s or time.time()
    run = _run("edge")
    since = int(run.cursor) if run.cursor.isdigit() else int(now_s) - FIRST_LOOKBACK_S
    lines = docker_client.edge_logs(since)
    edge_map = edge_module_map()
    user_clients = set(client_module_map())
    hits: dict[tuple[str, int], datetime] = {}
    modules: dict[int, Module] = {}
    newest = since
    for line in lines:
        parsed = parse_edge_line(line, edge_map, user_clients)
        if not parsed:
            continue
        subject, module, at = parsed
        modules[module.id] = module
        key = (subject, module.id)
        if key not in hits or at > hits[key]:
            hits[key] = at
        newest = max(newest, int(at.timestamp()))
    written = _record(hits, "last_activity_at", modules)
    # Même seconde relue au prochain passage : sans effet, les dates sont des maxima.
    run.cursor = str(max(newest, int(now_s) - 5))
    run.save(update_fields=["cursor"])
    return {"lines": len(lines), "hits": len(hits), "written": written}


# ── Journal des connexions Keycloak ──

def _keycloak_token() -> str:
    base = settings.KEYCLOAK_INTERNAL_URL.rstrip("/")
    response = requests.post(
        f"{base}/realms/{settings.KEYCLOAK_REALM}/protocol/openid-connect/token",
        data={"grant_type": "client_credentials", "client_id": settings.KEYCLOAK_COLLECTOR_CLIENT_ID,
              "client_secret": settings.KEYCLOAK_COLLECTOR_SECRET},
        timeout=TIMEOUT_S)
    if response.status_code != 200:
        raise RuntimeError(f"jeton Keycloak refusé : HTTP {response.status_code}")
    return response.json()["access_token"]


def fetch_login_events(since_ms: int) -> list[dict]:
    """Événements LOGIN plus récents que `since_ms`, du plus récent au plus ancien."""
    base = settings.KEYCLOAK_INTERNAL_URL.rstrip("/")
    headers = {"Authorization": f"Bearer {_keycloak_token()}"}
    date_from = datetime.fromtimestamp(since_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
    events: list[dict] = []
    first = 0
    while True:
        response = requests.get(
            f"{base}/admin/realms/{settings.KEYCLOAK_REALM}/events",
            params={"type": "LOGIN", "dateFrom": date_from, "first": first, "max": PAGE},
            headers=headers, timeout=TIMEOUT_S)
        if response.status_code != 200:
            raise RuntimeError(f"journal Keycloak : HTTP {response.status_code}")
        page = response.json()
        fresh = [event for event in page if int(event.get("time", 0)) > since_ms]
        events += fresh
        if len(page) < PAGE or len(fresh) < len(page):
            return events
        first += PAGE


def collect_keycloak(now_s: float | None = None) -> dict:
    if not settings.KEYCLOAK_INTERNAL_URL or not settings.KEYCLOAK_COLLECTOR_SECRET:
        return {"skipped": "Keycloak non configuré"}
    now_s = now_s or time.time()
    run = _run("keycloak")
    since_ms = int(run.cursor) if run.cursor.isdigit() else int((now_s - 7 * 86400) * 1000)
    events = fetch_login_events(since_ms)
    client_map = client_module_map()
    hits: dict[tuple[str, int | None], datetime] = {}
    modules: dict[int, Module] = {}
    usernames: dict[str, str] = {}
    newest = since_ms
    for event in events:
        subject = event.get("userId") or ""
        if not subject:
            continue
        at = datetime.fromtimestamp(int(event["time"]) / 1000, tz=timezone.utc)
        username = (event.get("details") or {}).get("username") or ""
        if username:
            usernames[subject] = username
        module = client_map.get(event.get("clientId") or "")
        if module:
            modules[module.id] = module
        key = (subject, module.id if module else None)
        if key not in hits or at > hits[key]:
            hits[key] = at
        newest = max(newest, int(event["time"]))
    written = _record(hits, "last_login_at", modules, usernames)
    run.cursor = str(newest)
    run.save(update_fields=["cursor"])
    return {"events": len(events), "written": written}


# ── Rétention ──

def purge(now=None) -> dict:
    from ..models import ContainerEvent

    now = now or djtz.now()
    access_limit = now - timedelta(days=settings.ACCESS_RETENTION_DAYS)
    event_limit = now - timedelta(days=settings.EVENT_RETENTION_DAYS)
    old_login = Q(last_login_at__isnull=True) | Q(last_login_at__lt=access_limit)
    old_activity = Q(last_activity_at__isnull=True) | Q(last_activity_at__lt=access_limit)
    accesses = UserModuleAccess.objects.filter(old_login & old_activity).delete()[0]
    users = KnownUser.objects.filter(accesses__isnull=True).exclude(last_seen_at__gte=access_limit).delete()[0]
    events = ContainerEvent.objects.filter(at__lt=event_limit).delete()[0]
    return {"accesses": accesses, "users": users, "events": events}
