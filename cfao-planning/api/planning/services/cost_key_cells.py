"""Saisie d'une cellule du prévisionnel, sûre à plusieurs.

La requête porte la valeur que l'utilisateur avait à l'écran (`expected`) : si elle a
changé entre-temps, rien n'est écrit et il choisit. Le contrôle et l'écriture se font
sous le verrou de la clé, celui que prennent aussi l'import et le gel.
"""
from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any
from uuid import UUID

from django.db import transaction

from referential.resolve import Resolver

from ..clients.needs import (
    CatalogLevelConflict,
    CatalogLevelRejected,
    CatalogUnavailable,
    fetch_catalog_levels,
    update_catalog_level,
)
from ..models import CostKeyYear, FrozenKeyError, PlannedAllocation, PlannedCellEdit, PlannedSession

MISSING: Any = object()
MAX_SEATS = 32767
TEXT_LIMITS = {"location": 96, "title": 255, "level": 64}
ALLOCATION = PlannedCellEdit.Target.ALLOCATION
SESSION = PlannedCellEdit.Target.SESSION
CELLS = {(ALLOCATION.value, "seats"), (SESSION.value, "start_date"), (SESSION.value, "end_date"),
         (SESSION.value, "location"), (SESSION.value, "title"), (SESSION.value, "level")}


class CellInvalid(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class CellGone(Exception):
    pass


class CellConflict(Exception):
    def __init__(self, details: dict):
        super().__init__("Cellule modifiée entre-temps.")
        self.details = details


@dataclass(frozen=True)
class CellResult:
    changed: bool
    value: Any
    edited_at: datetime | None


def raw(value: Any) -> Any:
    """Valeur au format JSON, celle du journal et de l'API."""
    return value.isoformat() if isinstance(value, date) else value


def _invalid(message: str) -> CellInvalid:
    return CellInvalid("INVALID_VALUE", message)


def _seats(value: Any, *, check_range: bool) -> int:
    if isinstance(value, str) and value.strip().isdigit():
        value = int(value)
    if isinstance(value, bool) or not isinstance(value, int):
        raise _invalid("Le nombre de places doit être un entier.")
    if check_range and not 1 <= value <= MAX_SEATS:
        raise _invalid(f"Le nombre de places va de 1 à {MAX_SEATS}.")
    return value


def _date(value: Any) -> date | None:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise _invalid("Date attendue au format AAAA-MM-JJ.")


def _text(value: Any, field: str, *, clean: bool) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        raise _invalid("Texte attendu.")
    if not clean:
        return value
    value = value.strip()
    if len(value) > TEXT_LIMITS[field]:
        raise _invalid(f"{TEXT_LIMITS[field]} caractères au maximum.")
    return value


def _parse(field: str, value: Any, *, clean: bool) -> Any:
    if field == "seats":
        return _seats(value, check_range=clean)
    if field in ("start_date", "end_date"):
        return _date(value)
    return _text(value, field, clean=clean)


def _check_start(row: PlannedSession, value: date | None) -> None:
    if value is None:
        raise CellInvalid("START_REQUIRED", "La date de début est obligatoire.")
    if value.year != row.cost_key.year:
        raise CellInvalid("START_OUTSIDE_YEAR", "Le début doit tomber dans l'année de la clé.")
    if row.end_date and value > row.end_date:
        raise CellInvalid("END_BEFORE_START", "La fin précède le début.")
    twin = PlannedSession.objects.filter(
        cost_key_id=row.cost_key_id, brand_id=row.brand_id, code_norm=row.code_norm,
        start_date=value, country_id=row.country_id,
    ).exclude(pk=row.pk)
    if twin.exists():
        raise CellInvalid("SESSION_EXISTS", "Cette session existe déjà à cette date.")


def _check_business_rules(row: Any, field: str, value: Any) -> None:
    if field == "start_date":
        _check_start(row, value)
    if field == "end_date" and value and row.start_date and value < row.start_date:
        raise CellInvalid("END_BEFORE_START", "La fin précède le début.")
    if field == "location" and value:
        # Le lieu désigne le pays hôte, qui fait partie de l'identité de la session : le
        # changer créerait un doublon facturé deux fois au prochain import.
        match = Resolver().country(value)
        if match is None:
            raise CellInvalid("UNKNOWN_LOCATION", "Lieu sans pays connu au référentiel.")
        if match.obj.pk != row.country_id:
            raise CellInvalid("LOCATION_HOST_CHANGE", "Ce lieu appartient à un autre pays hôte.")


def _load(key: CostKeyYear, target: str, target_id: UUID) -> PlannedAllocation | PlannedSession:
    if target == ALLOCATION:
        row = PlannedAllocation.objects.filter(pk=target_id, planned_session__cost_key=key).first()
    else:
        row = PlannedSession.objects.filter(pk=target_id, cost_key=key).first()
    if row is None:
        raise CellGone
    return row


def latest_edit(key: CostKeyYear, target_id: UUID, field: str) -> PlannedCellEdit | None:
    return (PlannedCellEdit.objects.filter(cost_key=key, target_id=target_id, field=field)
            .order_by("-created_at").first())


def manual_cells(key_ids: Iterable[UUID]) -> set[tuple[UUID, str]]:
    """Cellules dont le dernier changement est une saisie : un import ne les écrase pas."""
    rows = (PlannedCellEdit.objects.filter(cost_key_id__in=key_ids).order_by("created_at")
            .values_list("target_id", "field", "source"))
    latest = {(target_id, field): source for target_id, field, source in rows}
    return {cell for cell, source in latest.items() if source == PlannedCellEdit.Source.MANUAL}


def _edit_level(key: CostKeyYear, row: PlannedSession, expected: str, value: str,
                actor: str, actor_name: str) -> CellResult:
    """Le niveau vit au catalogue de cfao-needs : il y est écrit, le journal reste ici."""
    levels = fetch_catalog_levels(key.year)
    if not levels.available:
        raise CellInvalid("CATALOG_UNAVAILABLE", "Catalogue de formation indisponible.")
    module = levels.module(row.brand.code if row.brand_id else "", row.code_norm)
    if module is None:
        raise CellInvalid("LEVEL_NOT_IN_CATALOG", "Module absent du catalogue de formation.")
    last = latest_edit(key, row.pk, "level")
    try:
        result = update_catalog_level(module.line_ids, expected, value)
    except CatalogLevelConflict as exc:
        raise CellConflict({
            "target": SESSION.value, "id": str(row.pk), "field": "level",
            "expected": expected, "current": exc.current,
            "changed_by": (last.actor_name or None) if last else None,
            "changed_at": last.created_at.isoformat() if last else None,
            "source": last.source if last else None,
        })
    except CatalogLevelRejected:
        raise CellInvalid("LEVEL_NOT_IN_SCALE", "Ce niveau n'existe pas dans le barème de la marque.")
    except CatalogUnavailable:
        raise CellInvalid("CATALOG_UNAVAILABLE", "Catalogue de formation indisponible.")
    if not result["changed"]:
        return CellResult(False, value, last.created_at if last else None)
    edit = PlannedCellEdit.objects.create(
        cost_key=key, target=SESSION.value, target_id=row.pk, field="level",
        old_value=expected, new_value=value, actor=actor, actor_name=actor_name,
    )
    return CellResult(True, value, edit.created_at)


def edit_cell(key_id: UUID, *, target: Any, target_id: Any, field: Any, expected: Any, value: Any,
              actor: str, actor_name: str = "") -> CellResult:
    if (target, field) not in CELLS:
        raise _invalid("Cellule non modifiable.")
    if expected is MISSING or value is MISSING:
        raise _invalid("La valeur vue à l'écran et la nouvelle valeur sont obligatoires.")
    try:
        target_id = UUID(str(target_id))
    except ValueError:
        raise _invalid("Identifiant de ligne invalide.")
    value = _parse(field, value, clean=True)
    expected = _parse(field, expected, clean=False)

    with transaction.atomic():
        key = CostKeyYear.objects.select_for_update().get(pk=key_id)
        if key.is_frozen:
            raise FrozenKeyError(f"{key} est gelée : prévu non modifiable.")
        row = _load(key, target, target_id)
        if field == "level":
            return _edit_level(key, row, expected, value, actor, actor_name)
        current = getattr(row, field)
        last = latest_edit(key, target_id, field)
        if current == value:
            return CellResult(False, raw(value), last.created_at if last else None)
        if current != expected:
            raise CellConflict({
                "target": target, "id": str(target_id), "field": field,
                "expected": raw(expected), "current": raw(current),
                "changed_by": (last.actor_name or None) if last else None,
                "changed_at": last.created_at.isoformat() if last else None,
                "source": last.source if last else None,
            })
        _check_business_rules(row, field, value)
        setattr(row, field, value)
        written = [field, "updated_at"]
        if field == "start_date" and not row.start_moved:
            row.start_moved, row.source_start_date = True, current
            written += ["start_moved", "source_start_date"]
        row.save(update_fields=written)
        edit = PlannedCellEdit.objects.create(
            cost_key=key, target=target, target_id=target_id, field=field,
            old_value=raw(current), new_value=raw(value), actor=actor, actor_name=actor_name,
        )
        return CellResult(True, raw(value), edit.created_at)
