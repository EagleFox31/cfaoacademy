"""API de lecture de la supervision, préfixe /api/v1/supervision/.

Accès : ressource Cerbos `supervision_board` (état, versions, dépendances) et
`supervision_connections` (qui s'est connecté), action `read`, rôles platform_ops
et superadmin. Jamais exposés : identifiant Docker, identifiant d'image,
identifiant Keycloak d'un compte, adresse IP (sauf celle d'un poste refusé par le
pare-feu, vue `refused`, ressource `supervision_connections`).
"""
from __future__ import annotations

from datetime import datetime

from django.conf import settings
from django.http import Http404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authz import cerbos
from core.authz.permissions import CerbosPermission

from . import contracts
from . import status as rules
from .collectors import firewall
from .models import CollectRun, Container, ContainerEvent, Module, UserModuleAccess

UNKNOWN_USER = None  # le front affiche « Compte pas encore identifié »
HISTORY_LIMIT = 50
CONNECTIONS_LIMIT = 100


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _can(request, kind: str) -> bool:
    return cerbos.check(request.user.to_cerbos(), kind, "*", {}, "read")


class BoardView(APIView):
    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "supervision_board"
    cerbos_action = "read"


# ── Calculs communs ──

def _visible_modules() -> list[Module]:
    active = set(settings.SUPERVISION_PROJECTS)
    modules = list(Module.objects.filter(hidden=False).prefetch_related("containers"))
    return [m for m in modules if m.project in active or any(c.state != "absent" for c in m.containers.all())]


def _counted(module: Module) -> list[Container]:
    """Conteneurs qui comptent pour l'état : un conteneur disparu est ignoré si le
    projet a été recréé depuis (service retiré), pas si tout le projet a disparu."""
    containers = list(module.containers.all())
    present = [c for c in containers if c.state != "absent"]
    newest = max((c.created_at_docker for c in present if c.created_at_docker), default=None)
    return present + [c for c in containers if c.state == "absent"
                      and not (newest and c.last_seen_at and newest >= c.last_seen_at)]


def _container_status(container: Container) -> str:
    if container.state == "absent":
        return "down"
    return rules.container_status(container.state, container.health, container.exit_code,
                                  container.service, container.restart_policy)


def _since(container: Container, status: str) -> datetime | None:
    if container.state == "absent":
        return container.last_seen_at
    if status in ("down", "done"):
        return container.finished_at
    return container.started_at


def _module_summary(module: Module) -> dict:
    counted = _counted(module)
    statuses = [_container_status(c) for c in counted]
    status = rules.module_status(statuses)
    worst = [c for c, s in zip(counted, statuses) if s == status]
    since_values = [_since(c, status) for c in worst if _since(c, status)]
    # En panne depuis : la plus ancienne panne ; en ligne depuis : le plus récent démarrage.
    since = (min(since_values) if status != "ok" else max(since_values)) if since_values else None
    ordered = sorted(counted, key=lambda c: (c.state != "running", rules.is_one_shot(c.service), c.service))
    version, detail = rules.module_version(
        [{"image_ref": c.image_ref, "image_tag": c.image_tag, "version_label": c.version_label} for c in ordered],
        module.project, settings.SUPERVISION_IMAGE_NAMESPACES)
    deployed = max((c.created_at_docker for c in counted if c.created_at_docker), default=None)
    provides: dict[str, str] = {}
    for container in counted:
        provides.update(contracts.parse_label(container.provides))
    return {
        "project": module.project,
        "name": module.display_name,
        "status": status,
        "since": _iso(since),
        "version": version,
        "version_detail": detail,
        "deployed_at": _iso(deployed),
        "containers": len([c for c in counted if c.state != "absent"]),
        "problems": sum(1 for s in statuses if rules.SEVERITY.get(s, 3) >= 2),
        "ports": sorted({p["public"] for c in counted for p in (c.ports or [])}),
        "provides": [{"contract": name, "version": provides[name]} for name in sorted(provides)],
    }


def _accesses(module: Module | None = None):
    queryset = UserModuleAccess.objects.select_related("user", "module")
    if module is not None:
        queryset = queryset.filter(module=module)
    rows = []
    for access in queryset:
        last = max(filter(None, [access.last_login_at, access.last_activity_at]), default=None)
        if last:
            rows.append((last, access))
    rows.sort(key=lambda row: row[0], reverse=True)
    return rows


def _access_row(last: datetime, access: UserModuleAccess) -> dict:
    return {
        "user": access.user.username or UNKNOWN_USER,
        "project": access.module.project,
        "module": access.module.display_name,
        "last_at": _iso(last),
        "last_login_at": _iso(access.last_login_at),
        "last_activity_at": _iso(access.last_activity_at),
    }


def _collect_state() -> dict:
    runs = {run.source: run for run in CollectRun.objects.all()}
    docker = runs.get("docker")
    last = docker.last_success_at if docker else None
    stale = last is None or (timezone.now() - last).total_seconds() > settings.STALE_AFTER_S
    return {
        "collected_at": _iso(last),
        "stale": stale,
        "sources": {name: {"ok": run.ok, "last_success_at": _iso(run.last_success_at)}
                    for name, run in sorted(runs.items())},
    }


# ── Vues ──

class AccessView(APIView):
    """Ce que l'utilisateur connecté peut voir (le portail s'en sert pour son menu)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"board": _can(request, "supervision_board"),
                         "connections": _can(request, "supervision_connections")})


class OverviewView(BoardView):
    def get(self, request):
        modules = _visible_modules()
        summaries = [_module_summary(m) for m in modules]
        known = {m.project for m in modules}
        for project in settings.SUPERVISION_PROJECTS:
            if project not in known:  # surveillé mais jamais vu : en panne
                summaries.append({"project": project, "name": project, "status": "down", "since": None,
                                  "version": None, "version_detail": None, "deployed_at": None,
                                  "containers": 0, "problems": 0, "ports": [], "provides": []})
        if _can(request, "supervision_connections"):
            latest: dict[str, tuple] = {}
            for last, access in _accesses():
                latest.setdefault(access.module.project, (last, access))
            for summary in summaries:
                row = latest.get(summary["project"])
                summary["last_connection"] = _access_row(*row) if row else None
            refused = firewall.summary(hours=1)
            body_refused = {"alerts": refused["alerts"], "recent": sum(n["recent"] for n in refused["networks"])}
        else:
            body_refused = None
        counts = {key: sum(1 for s in summaries if s["status"] == key)
                  for key in ("ok", "done", "starting", "degraded", "crashloop", "down")}
        return Response({**_collect_state(), "counts": counts, "modules": summaries, "refused": body_refused})


def _get_module(project: str) -> Module:
    module = Module.objects.filter(project=project).prefetch_related("containers").first()
    if module is None:
        raise Http404
    return module


class ModuleDetailView(BoardView):
    def get(self, request, project: str):
        module = _get_module(project)
        counted = _counted(module)
        containers = []
        for container in sorted(module.containers.all(), key=lambda c: (c.service, c.number)):
            status = _container_status(container)
            version, detail = rules.version_display(container.image_tag, container.version_label)
            containers.append({
                "service": container.service,
                "number": container.number,
                "name": container.name,
                "status": status,
                "counted": container in counted,
                "state": container.state,
                "health": container.health,
                "exit_code": container.exit_code,
                "restart_count": container.restart_count,
                "since": _iso(_since(container, status)),
                "image": container.image_ref,
                "version": version,
                "version_detail": detail,
                "revision": container.revision[:12],
                "built_at": _iso(container.image_created_at),
                "deployed_at": _iso(container.created_at_docker),
                "started_at": _iso(container.started_at),
                "last_seen_at": _iso(container.last_seen_at),
                "ports": container.ports,
                "exposed": container.exposed,
                "networks": container.networks,
                "depends_on": container.depends_on,
                "provides": contracts.parse_label(container.provides),
                "consumes": contracts.parse_label(container.consumes),
            })
        changelog = next((c.changelog for c in sorted(counted, key=lambda c: c.service) if c.changelog), "")
        body = {**_module_summary(module), "public_prefix": module.public_prefix,
                "changelog": changelog, "container_list": containers}
        if _can(request, "supervision_connections"):
            body["connections"] = [_access_row(*row) for row in _accesses(module)[:20]]
        return Response(body)


class ModuleHistoryView(BoardView):
    def get(self, request, project: str):
        module = _get_module(project)
        events = ContainerEvent.objects.filter(container__module=module).select_related("container")[:HISTORY_LIMIT]
        return Response({"project": project, "events": [
            {"at": _iso(e.at), "service": e.container.service, "kind": e.kind, "before": e.before, "after": e.after}
            for e in events]})


class DependenciesView(BoardView):
    """Qui fournit quelle API à qui, et si les versions s'accordent."""

    def get(self, request):
        providers: dict[str, list[tuple[str, str]]] = {}
        consumers: list[tuple[str, str, str]] = []
        for module in _visible_modules():
            for container in module.containers.all():
                if container.state != "running":
                    continue
                for name, version in contracts.parse_label(container.provides).items():
                    providers.setdefault(name, []).append((module.project, version))
                for name, version_range in contracts.parse_label(container.consumes).items():
                    consumers.append((module.project, name, version_range))
        links = []
        for consumer, name, version_range in sorted(set(consumers)):
            offers = sorted(set(providers.get(name, [])))
            if not offers:
                links.append({"contract": name, "consumer": consumer, "expects": version_range,
                              "provider": None, "provides": None, "status": "missing"})
                continue
            for provider, version in offers:
                ok = contracts.satisfies(version, version_range)
                links.append({"contract": name, "consumer": consumer, "expects": version_range,
                              "provider": provider, "provides": version,
                              "status": "unknown" if ok is None else ("ok" if ok else "incompatible")})
        used = {link["contract"] for link in links}
        unused = [{"contract": name, "provider": provider, "provides": version}
                  for name, offers in sorted(providers.items()) if name not in used
                  for provider, version in sorted(set(offers))]
        return Response({"links": links, "unused": unused})


class ConnectionsView(APIView):
    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "supervision_connections"
    cerbos_action = "read"

    def get(self, request):
        return Response({"retention_days": settings.ACCESS_RETENTION_DAYS,
                         "connections": [_access_row(*row) for row in _accesses()[:CONNECTIONS_LIMIT]]})


class RefusedView(ConnectionsView):
    """Postes refusés par le pare-feu du serveur. Seule vue qui montre une adresse IP
    (celle du poste, pour le retrouver), d'où la même ressource que les connexions."""

    def get(self, request):
        try:
            hours = min(max(int(request.query_params.get("hours", 24)), 1), 24 * 7)
        except ValueError:
            hours = 24
        run = CollectRun.objects.filter(source=firewall.SOURCE).first()
        source = None if run is None else {"ok": run.ok, "last_success_at": _iso(run.last_success_at)}
        return Response({**firewall.summary(hours=hours), "source": source})
