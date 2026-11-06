"""Gel de la clé de répartition (SPEC §8 « Gel et comparaison »).

Geler fige le prévu (statut FROZEN, gardes des modèles) et prend un snapshot du
rapport : c'est lui qui sert à la refacturation, même si le référentiel change
ensuite. Pas de dégel dans ce lot.
"""
from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping

from django.db import transaction
from django.utils import timezone

from ..models import CostKeyStatus, CostKeySnapshot, CostKeyYear
from .cost_key import COST_KEY_ENGINE, Mode, compute


class FreezeRefused(Exception):
    pass


def inputs_sha256(key: CostKeyYear) -> str:
    """Empreinte des lignes prévues triées et des paramètres de la clé. Les
    identifiants (pas les libellés) : renommer un formateur ne la change pas."""
    sessions = sorted(
        [
            str(p.brand_id), p.code_norm, str(p.start_date), str(p.end_date), p.location,
            str(p.country_id), sorted(str(t.pk) for t in p.trainers.all()),
            sorted((str(a.country_id), a.seats) for a in p.allocations.all()),
        ]
        for p in key.planned_sessions.prefetch_related("trainers", "allocations")
    )
    params = [str(key.budget), str(key.trainee_lodging_cost), str(key.trainer_lodging_cost),
              key.hours_per_session,
              sorted(str(pk) for pk in key.enrolled_countries.values_list("pk", flat=True))]
    payload = json.dumps([key.year, key.pole, params, sessions], ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()


def freeze(key: CostKeyYear, actor: str, needs: Mapping[str, int] | None = None
           ) -> CostKeySnapshot:
    with transaction.atomic():
        key = CostKeyYear.objects.select_for_update().get(pk=key.pk)
        sha = inputs_sha256(key)
        if key.is_frozen:
            snapshot = key.snapshot
            if snapshot.inputs_sha256 != sha:
                raise FreezeRefused(f"{key} déjà gelée sur un autre prévu.")
            return snapshot
        if not key.planned_sessions.exists():
            raise FreezeRefused(f"{key} : aucune session prévue, rien à geler.")
        report = compute(key, needs, mode=Mode.PLANNED)
        distributed = sum(line.key_cost for line in report.lines)
        if distributed != key.budget:
            raise FreezeRefused(
                f"{key} : {distributed} réparti sur un budget de {key.budget}.")
        snapshot = CostKeySnapshot.objects.create(
            cost_key=key, report=report.to_dict(), needs=dict(needs or {}),
            inputs_sha256=sha, engine_version=COST_KEY_ENGINE, created_by=actor,
        )
        key.status = CostKeyStatus.FROZEN
        key.frozen_at = timezone.now()
        key.frozen_by = actor
        key.save(update_fields=["status", "frozen_at", "frozen_by", "updated_at"])
        return snapshot
