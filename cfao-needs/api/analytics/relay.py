"""Livraison de la copie des besoins à cfao-planning (consommateur du contrat `needs-snapshot-push`).

Coalescence : quel que soit le nombre de versions en attente, on envoie UN
snapshot, le plus récent, et il solde toutes les versions qu'il couvre. Planning
ignore une version déjà connue : renvoyer est sans danger (idempotent).
"""
from __future__ import annotations

import logging
from datetime import timedelta

import requests
from django.conf import settings
from django.db.models import F
from django.utils import timezone

from .models import NeedsOutbox
from .snapshot import build_snapshot

log = logging.getLogger(__name__)

PUSH_PATH = "/api/v1/planning/internal/needs-snapshot"
PUSH_TIMEOUT_S = 10
RETENTION = timedelta(days=30)


def push_enabled() -> bool:
    return bool(getattr(settings, "PLANNING_API_URL", "") and getattr(settings, "NEEDS_SNAPSHOT_PUSH_KEY", ""))


def backoff(attempts: int) -> timedelta:
    """5 s, 10 s, 20 s… plafonné ; `attempts` = échecs déjà comptés, celui-ci compris."""
    cap = int(getattr(settings, "NEEDS_RELAY_MAX_BACKOFF_S", 600))
    return timedelta(seconds=min(5 * 2 ** max(attempts - 1, 0), cap))


def _send(snapshot: dict) -> str | None:
    """None si planning a accepté (appliquée ou déjà connue), sinon le motif de l'échec."""
    url = settings.PLANNING_API_URL.rstrip("/") + PUSH_PATH
    try:
        response = requests.post(url, json=snapshot, timeout=PUSH_TIMEOUT_S,
                                 headers={"X-Needs-Snapshot-Key": settings.NEEDS_SNAPSHOT_PUSH_KEY})
    except requests.RequestException as exc:
        return f"unreachable: {type(exc).__name__}"
    if response.status_code == 200:
        return None
    return f"HTTP {response.status_code}"


def deliver_pending(now=None) -> str:
    """Un passage du relais. Renvoie ce qui s'est passé (journal et tests)."""
    now = now or timezone.now()
    NeedsOutbox.objects.filter(created_at__lt=now - RETENTION).delete()
    pending = NeedsOutbox.objects.filter(delivered_at__isnull=True)
    if not pending.filter(next_attempt_at__lte=now).exists():
        return "idle"
    if not push_enabled():
        return "disabled"
    snapshot = build_snapshot()
    error = _send(snapshot)
    covered = pending.filter(version__lte=snapshot["version"])
    if error is None:
        covered.update(delivered_at=now, last_error="")
        log.info("copie des besoins v%s livrée à cfao-planning", snapshot["version"])
        return "delivered"
    covered.update(attempts=F("attempts") + 1, last_error=error[:255])
    attempts = max(covered.values_list("attempts", flat=True), default=1)
    covered.update(next_attempt_at=now + backoff(attempts))
    log.warning("copie des besoins v%s non livrée (%s), essai %s", snapshot["version"], error, attempts)
    return "failed"
