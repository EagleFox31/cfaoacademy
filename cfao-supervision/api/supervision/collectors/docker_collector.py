"""Collecte de l'état des conteneurs (toutes les 15 s).

Seuls les projets compose de SUPERVISION_PROJECTS sont lus ; le reste de la machine
est ignoré. Un `inspect` n'est fait que pour un conteneur nouveau ou qui a changé.
Jamais lus : variables d'environnement (Config.Env), volumes (Mounts), commande.
Un événement n'est écrit que sur un changement : une collecte sans changement
n'écrit que l'heure de dernière vue.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

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


def exposed_of(summary: dict, inspected: dict | None) -> list[str]:
    """Ports écoutés dans le réseau Docker (non publiés sur l'hôte)."""
    if inspected:
        keys = ((inspected.get("Config") or {}).get("ExposedPorts") or {}).keys()
        return sorted(keys)
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
    """Une collecte. Renvoie un résumé (vus, inspectés, événements)."""
    now = now or djtz.now()
    summaries = docker_client.list_containers()
    picked = _pick(summaries)
    modules = {m.project: m for m in Module.objects.all()}
    existing = {(c.module.project, c.service, c.number): c
                for c in Container.objects.select_related("module").filter(module__project__in=settings.SUPERVISION_PROJECTS)}
    inspected_count = 0
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
                inspected_count += 1
                details = docker_client.inspect(container.docker_id)
                state = details.get("State") or {}
                container.started_at = parse_time(state.get("StartedAt"))
                container.finished_at = parse_time(state.get("FinishedAt"))
                container.exit_code = state.get("ExitCode")
                container.restart_count = details.get("RestartCount") or 0
                container.restart_policy = (((details.get("HostConfig") or {}).get("RestartPolicy") or {})
                                            .get("Name") or "")[:40]
                container.exposed = exposed_of(summary, details)
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

    return {"seen": len(picked), "inspected": inspected_count,
            "events": ContainerEvent.objects.count() - events_before}
