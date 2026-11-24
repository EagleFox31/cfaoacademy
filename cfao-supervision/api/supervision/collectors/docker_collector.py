"""Collecte de l'état des conteneurs (toutes les 15 s).

Seuls les projets compose de SUPERVISION_PROJECTS sont lus ; le reste de la machine
est ignoré. Seule la liste des conteneurs est lue (GET /containers/json), jamais
leur `inspect` : celui-ci renvoie les variables d'environnement (secrets) de tous
les conteneurs, et le proxy du socket le refuse. Code de sortie et horodatages sont
tirés du texte `Status` (« Up 3 minutes », « Exited (1) 5 seconds ago »), relu à
chaque changement, donc précis à la collecte près.
Un événement n'est écrit que sur un changement : une collecte sans changement
n'écrit que l'heure de dernière vue.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.db import transaction
from django.utils import timezone as djtz

from .. import status as rules
from ..models import Container, ContainerEvent, Module
from . import docker_client

LABEL_PROJECT = "com.docker.compose.project"
LABEL_SERVICE = "com.docker.compose.service"
LABEL_NUMBER = "com.docker.compose.container-number"
LABEL_DEPENDS = "com.docker.compose.depends_on"
LABEL_VERSION = "org.opencontainers.image.version"
LABEL_REVISION = "org.opencontainers.image.revision"
LABEL_CREATED = "org.opencontainers.image.created"
LABEL_CHANGELOG = "org.cfao.changelog"
LABEL_PROVIDES = "org.cfao.contracts.provides"
LABEL_CONSUMES = "org.cfao.contracts.consumes"

_HEALTH_IN_STATUS = re.compile(r"\((healthy|unhealthy|health: starting)\)")
_FRACTION = re.compile(r"\.(\d{6})\d+")
_EXIT_CODE = re.compile(r"^(?:Exited|Restarting) \((-?\d+)\)")
# Durées de Docker (go-units HumanDuration) : « 5 seconds », « About a minute », « 3 hours »…
_AGE = re.compile(r"^(?:Up|Exited \(-?\d+\)|Restarting \(-?\d+\)) (.+?)(?: ago)?(?: \(.*\))?$")
_UNIT_S = {"second": 1, "minute": 60, "hour": 3600, "day": 86400, "week": 604800,
           "month": 2_592_000, "year": 31_536_000}


def parse_time(value: str | None) -> datetime | None:
    """Horodatage Docker (nanosecondes, Z) -> datetime ; l'an 1 = jamais."""
    if not value or value.startswith("0001-01-01"):
        return None
    text = _FRACTION.sub(r".\1", value.replace("Z", "+00:00"))
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def health_from_status(status_text: str) -> str:
    match = _HEALTH_IN_STATUS.search(status_text or "")
    if not match:
        return ""
    return "starting" if match.group(1) == "health: starting" else match.group(1)


def ports_of(summary: dict) -> list[dict]:
    """Ports publiés sur l'hôte, sans doublon IPv4/IPv6."""
    seen, ports = set(), []
    for port in summary.get("Ports") or []:
        if not port.get("PublicPort"):
            continue
        host = port.get("IP") or "0.0.0.0"
        if host == "::":
            host = "0.0.0.0"
        key = (host, port["PublicPort"], port.get("PrivatePort"), port.get("Type", "tcp"))
        if key in seen:
            continue
        seen.add(key)
        ports.append({"host": host, "public": port["PublicPort"], "private": port.get("PrivatePort"),
                      "proto": port.get("Type", "tcp")})
    return sorted(ports, key=lambda p: (p["public"], p["host"]))


def exit_code_from_status(status_text: str) -> int | None:
    match = _EXIT_CODE.search(status_text or "")
    return int(match.group(1)) if match else None


def age_from_status(status_text: str) -> int | None:
    """Âge en secondes de l'état courant d'après `Status` ; None si illisible."""
    match = _AGE.search((status_text or "").strip())
    if not match:
        return None
    text = match.group(1).lower()
    if text.startswith("less than a second"):
        return 0
    words = text.removeprefix("about ").split()
    if len(words) != 2:
        return None
    count, unit = words
    count = 1 if count in ("a", "an") else count
    try:
        number = int(count)
    except ValueError:
        return None
    seconds = _UNIT_S.get(unit.rstrip("s"))
    return None if seconds is None else number * seconds


def exposed_of(summary: dict) -> list[str]:
    """Ports écoutés dans le réseau Docker (non publiés sur l'hôte)."""
    return sorted({f"{p['PrivatePort']}/{p.get('Type', 'tcp')}" for p in summary.get("Ports") or []
                   if p.get("PrivatePort") and not p.get("PublicPort")})


def depends_of(labels: dict) -> list[str]:
    # « service:condition:restart,autre:condition:restart »
    return sorted({item.split(":", 1)[0] for item in (labels.get(LABEL_DEPENDS) or "").split(",") if item})


def _fingerprint(summary: dict) -> tuple:
    return (summary.get("Id"), summary.get("State"), health_from_status(summary.get("Status", "")))


def _pick(summaries: list[dict]) -> dict[tuple[str, str, int], dict]:
    """Un conteneur par (projet, service, numéro) : le plus récent."""
    allowed = set(settings.SUPERVISION_PROJECTS)
    picked: dict[tuple[str, str, int], dict] = {}
    for summary in summaries:
        labels = summary.get("Labels") or {}
        project = labels.get(LABEL_PROJECT)
        service = labels.get(LABEL_SERVICE)
        if not project or not service or project not in allowed:
            continue
        try:
            number = int(labels.get(LABEL_NUMBER) or 1)
        except ValueError:
            number = 1
        key = (project, service, number)
        if key not in picked or summary.get("Created", 0) > picked[key].get("Created", 0):
            picked[key] = summary
    return picked


def _module(project: str, cache: dict[str, Module]) -> Module:
    if project not in cache:
        cache[project], _ = Module.objects.get_or_create(
            project=project, defaults={"display_name": project, "sort_order": 900})
    return cache[project]


def _event(container: Container, now, kind: str, before: str, after: str) -> None:
    if before != after:
        ContainerEvent.objects.create(container=container, at=now, kind=kind, before=before[:200], after=after[:200])


def _version_text(container: Container) -> str:
    version, detail = rules.version_display(container.image_tag, container.version_label)
    return " ".join(part for part in (version or "?", f"({detail})" if detail else "") if part)


def collect(now=None) -> dict:
    """Une collecte. Renvoie un résumé (vus, changés, événements)."""
    now = now or djtz.now()
    summaries = docker_client.list_containers()
    picked = _pick(summaries)
    modules = {m.project: m for m in Module.objects.all()}
    existing = {(c.module.project, c.service, c.number): c
                for c in Container.objects.select_related("module").filter(module__project__in=settings.SUPERVISION_PROJECTS)}
    changed_count = 0
    events_before = ContainerEvent.objects.count()

    with transaction.atomic():
        for key, summary in picked.items():
            project, service, number = key
            container = existing.get(key)
            is_new = container is None
            if is_new:
                container = Container(module=_module(project, modules), service=service, number=number)
            changed = is_new or container.state == "absent" or _fingerprint(summary) != (
                container.docker_id, container.state, container.health)
            before_state, before_health = container.state, container.health
            before_version, before_image = _version_text(container), container.image_id
            same_instance = not is_new and container.docker_id == summary.get("Id", "")

            labels = summary.get("Labels") or {}
            container.name = ((summary.get("Names") or [""])[0]).lstrip("/")
            container.docker_id = summary.get("Id", "")
            container.image_ref = summary.get("Image", "")
            container.image_tag = rules.image_tag(container.image_ref)
            container.image_id = summary.get("ImageID", "")
            container.version_label = labels.get(LABEL_VERSION, "")[:120]
            container.revision = labels.get(LABEL_REVISION, "")[:80]
            container.changelog = labels.get(LABEL_CHANGELOG, "")[:4000]
            container.image_created_at = parse_time(labels.get(LABEL_CREATED))
            container.state = summary.get("State", "unknown")
            container.health = health_from_status(summary.get("Status", ""))
            container.ports = ports_of(summary)
            container.network_mode = ((summary.get("HostConfig") or {}).get("NetworkMode") or "")[:80]
            container.networks = sorted(((summary.get("NetworkSettings") or {}).get("Networks") or {}).keys())
            container.provides = labels.get(LABEL_PROVIDES, "")[:500]
            container.consumes = labels.get(LABEL_CONSUMES, "")[:500]
            container.depends_on = depends_of(labels)
            if summary.get("Created"):
                container.created_at_docker = datetime.fromtimestamp(summary["Created"], tz=timezone.utc)
            container.last_seen_at = now

            if changed:
                changed_count += 1
                status_text = summary.get("Status", "")
                age = age_from_status(status_text)
                since = now - timedelta(seconds=age) if age is not None else None
                container.exit_code = exit_code_from_status(status_text)
                if container.state == "running":
                    container.started_at = since or container.created_at_docker
                elif container.state in ("exited", "dead"):
                    container.finished_at = since
                if not same_instance:
                    container.restart_count = 0
                elif container.state == "restarting" or (container.state == "running"
                                                         and before_state in ("exited", "dead")):
                    container.restart_count += 1
                container.exposed = exposed_of(summary)
            container.save()

            if not is_new:
                _event(container, now, "state", before_state, container.state)
                _event(container, now, "health", before_health, container.health)
                if before_image and before_image != container.image_id:
                    _event(container, now, "version", before_version, _version_text(container))

        for key, container in existing.items():
            if key not in picked and container.state != "absent":
                _event(container, now, "absent", container.state, "absent")
                container.state = "absent"
                container.health = ""
                container.docker_id = ""
                container.save(update_fields=["state", "health", "docker_id"])

    return {"seen": len(picked), "changed": changed_count,
            "events": ContainerEvent.objects.count() - events_before}
