"""Copie locale des besoins de cfao-needs (contrat `needs-snapshot-push`).

Seul point d'entrée des écritures dans la copie : `apply_snapshot`, appelé par
le push du relais de cfao-needs et par le rattrapage (GET /analytics/snapshot).
Le document est validé en entier avant toute écriture : une copie partielle ou
mal formée n'est jamais appliquée.

  - push : appliqué seulement si sa version dépasse la version connue (un vieux
    message arrivé en retard ne recule jamais la copie) ;
  - pull : appliqué dès que la version diffère (ce que needs sert maintenant est
    la vérité, y compris après une restauration de sa base).
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from ..models import NeedsCopyState, NeedsCopyYear

POLES = ("motors", "equipment", "all")
PUSH, PULL = "push", "pull"


class SnapshotInvalid(ValueError):
    pass


def _require(condition: bool, where: str) -> None:
    if not condition:
        raise SnapshotInvalid(where)


def _is_int(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _rows(body, key: str, fields: tuple[str, ...], where: str) -> None:
    rows = body.get(key)
    _require(isinstance(rows, list), f"{where}.{key}")
    for i, row in enumerate(rows):
        _require(isinstance(row, dict) and all(f in row for f in fields), f"{where}.{key}[{i}]")


def _check_year(year: str, body) -> None:
    where = f"years.{year}"
    _require(year.lstrip("-").isdigit() and isinstance(body, dict), where)
    for kind in ("needs_by_branch_brand", "unchosen_modules"):
        by_pole = body.get(kind)
        _require(isinstance(by_pole, dict) and all(isinstance(by_pole.get(p), dict) for p in POLES),
                 f"{where}.{kind}")
    for pole in POLES:
        needs = body["needs_by_branch_brand"][pole]
        _require(isinstance(needs.get("source"), str), f"{where}.needs.{pole}.source")
        _rows(needs, "rows", ("country", "brand", "needs", "technicians"), f"{where}.needs.{pole}")
        if "postponed" in needs:
            _rows(needs, "postponed", ("country", "brand", "code", "places"), f"{where}.needs.{pole}")
        unchosen = body["unchosen_modules"][pole]
        _require(isinstance(unchosen.get("catalog_available"), bool), f"{where}.unchosen.{pole}")
        _rows(unchosen, "modules", ("pole", "brand", "tier", "code", "title"), f"{where}.unchosen.{pole}")
    levels = body.get("catalog_levels")
    _require(isinstance(levels, dict), f"{where}.catalog_levels")
    _rows(levels, "lines", ("id", "brand", "code", "level_label", "tier", "sort_order"),
          f"{where}.catalog_levels")


def validate(payload) -> tuple[int, object, dict[int, dict]]:
    """(version, generated_at, {année: lectures}) ou SnapshotInvalid."""
    _require(isinstance(payload, dict), "document")
    version, years = payload.get("version"), payload.get("years")
    _require(_is_int(version) and version >= 0, "version")
    generated_at = parse_datetime(payload.get("generated_at") or "") if isinstance(
        payload.get("generated_at"), str) else None
    _require(generated_at is not None, "generated_at")
    _require(isinstance(years, dict), "years")
    for year, body in years.items():
        _check_year(str(year), body)
    return version, generated_at, {int(year): body for year, body in years.items()}


def known_version() -> int | None:
    state = NeedsCopyState.objects.filter(pk=1).first()
    return state.version if state else None


def apply_snapshot(payload, mode: str) -> bool:
    """True si la copie a changé. Une version déjà connue ne réécrit rien (idempotent)."""
    version, generated_at, years = validate(payload)
    with transaction.atomic():
        state = NeedsCopyState.objects.select_for_update().filter(pk=1).first()
        if state is None:  # la migration la crée ; filet si la ligne a été effacée
            state = NeedsCopyState.objects.create(pk=1)
            state = NeedsCopyState.objects.select_for_update().get(pk=1)
        known = state.version
        if known is not None and (version <= known if mode == PUSH else version == known):
            return False
        NeedsCopyYear.objects.exclude(year__in=years).delete()
        for year, body in years.items():
            NeedsCopyYear.objects.update_or_create(year=year, defaults={"version": version, "payload": body})
        state.version, state.generated_at, state.received_at = version, generated_at, timezone.now()
        state.save()
    return True
