"""Règles d'état, en fonctions pures (testées sans base ni Docker).

États d'un conteneur, du meilleur au pire :
  ok        tourne (et sain s'il a une sonde)
  done      job ponctuel terminé sans erreur (migrate, bootstrap)
  starting  démarre, la sonde n'a pas encore répondu
  degraded  tourne mais la sonde le dit malade
  crashloop redémarre en boucle
  down      arrêté, en erreur ou disparu
L'état d'un module est le pire de ses conteneurs ; un module sans conteneur est down.
"""
from __future__ import annotations

import re

SEVERITY = {"ok": 0, "done": 0, "starting": 1, "degraded": 2, "crashloop": 3, "down": 3}

# Étiquettes qui ne disent rien de la version réellement déployée.
_VAGUE = {"", "latest", "dev", "recette", "main", "master", "local", "edge", "stable"}

# Un service ponctuel : sa sortie en 0 est un succès, pas une panne.
_ONE_SHOT = re.compile(r"(^|[-_])(migrate|migration|bootstrap|seed|init|config)($|[-_])")


def is_one_shot(service: str, restart_policy: str = "") -> bool:
    """Reconnu à son nom seul : un service permanent sans politique de redémarrage
    qui s'arrête reste une panne."""
    return bool(_ONE_SHOT.search(service or ""))


def container_status(state: str, health: str, exit_code: int | None, service: str = "",
                     restart_policy: str = "") -> str:
    state = (state or "").lower()
    health = (health or "").lower()
    if state == "running":
        if health == "unhealthy":
            return "degraded"
        if health == "starting":
            return "starting"
        return "ok"
    if state == "restarting":
        return "crashloop"
    if state == "exited" and exit_code == 0 and is_one_shot(service, restart_policy):
        return "done"
    if state == "created" and is_one_shot(service, restart_policy):
        return "starting"
    return "down"


def module_status(statuses: list[str]) -> str:
    if not statuses:
        return "down"
    return max(statuses, key=lambda status: SEVERITY.get(status, 3))


def is_vague(tag: str) -> bool:
    return (tag or "").strip().lower() in _VAGUE


def image_tag(image_ref: str) -> str:
    """`registre:5000/org/nom:1.2.0@sha256:…` -> `1.2.0` ; sans étiquette -> `latest`."""
    if (image_ref or "").startswith("sha256:"):  # conteneur lancé depuis un identifiant d'image
        return ""
    ref = (image_ref or "").split("@", 1)[0]
    last = ref.rsplit("/", 1)[-1]
    if ":" in last:
        return last.rsplit(":", 1)[1]
    return "latest" if ref else ""


def version_display(tag: str, label: str) -> tuple[str | None, str | None]:
    """(version à afficher, précision). None = version inconnue.

    L'étiquette de l'image prime ; le label OCI la complète s'il dit autre chose,
    et la remplace si l'étiquette est vague (latest, dev…).
    """
    tag = (tag or "").strip()
    label = (label or "").strip()
    if not is_vague(tag):
        detail = label if label and not is_vague(label) and label.lstrip("v") != tag.lstrip("v") else None
        return tag, detail
    if label and not is_vague(label):
        return label, None
    return None, None


def is_own_image(image_ref: str, project: str, namespaces: list[str] | tuple[str, ...] = ()) -> bool:
    """Image construite par la plateforme : par le projet lui-même (`<projet>-<service>`)
    ou publiée sous l'un de ses espaces de registre. Une image tierce (postgres,
    cerbos, mongo…) ne dit rien de la version du module."""
    ref = (image_ref or "").split("@", 1)[0]
    if not ref or ref.startswith("sha256:"):
        return False
    head, _, last = ref.rpartition("/")
    repository = f"{head}/{last.split(':', 1)[0]}" if head else last.split(":", 1)[0]
    if project and repository.startswith(f"{project}-"):
        return True
    return any(ns and repository.startswith(ns) for ns in namespaces)


def module_version(containers: list[dict], project: str = "",
                   namespaces: list[str] | tuple[str, ...] = ()) -> tuple[str | None, str | None]:
    """Version d'un module : celle de son premier conteneur construit par la plateforme
    qui en annonce une. Aucun : version inconnue, jamais celle d'une image tierce."""
    for container in containers:
        if not is_own_image(container.get("image_ref", ""), project, namespaces):
            continue
        version, detail = version_display(container.get("image_tag", ""), container.get("version_label", ""))
        if version:
            return version, detail
    return None, None
