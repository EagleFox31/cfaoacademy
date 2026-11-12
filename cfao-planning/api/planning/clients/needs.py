"""Consommateur du contrat `needs-analytics` (contracts/registry.json, `^1.4`).

Les besoins et les thématiques non choisies viennent de cfao-needs, jamais d'une
ressaisie. Ils sont lus dans la COPIE locale (`NeedsCopyYear`) que cfao-needs
pousse à chaque changement (contrat `needs-snapshot-push`) : un changement de
pôle à l'écran n'attend plus cfao-needs. La copie est revérifiée au plus toutes
les `NEEDS_SNAPSHOT_RECHECK_S` secondes par un GET conditionnel (ETag), en
arrière-plan quand une copie existe déjà.

Les libellés bruts (pays, marque) sont résolus par les alias du référentiel ; un
libellé inconnu est **signalé**, jamais compté à 0. Sans aucune copie et sans
cfao-needs, les besoins valent None et un avertissement le dit : un taux de
couverture vide vaut mieux qu'un taux faux. Avec une copie mais sans cfao-needs,
l'avertissement `needs_snapshot_stale` donne la date des données.
"""
from __future__ import annotations

import logging
import threading
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import requests
from django.conf import settings
from django.db import connections

from referential.normalize import norm_code
from referential.resolve import Resolver

from ..models import NeedsCopyState, NeedsCopyYear
from ..services.needs_copy import PULL, SnapshotInvalid, apply_snapshot, known_version

log = logging.getLogger(__name__)

SNAPSHOT = "/api/v1/needs/analytics/snapshot"
CATALOG_LEVEL = "/api/v1/needs/analytics/catalog-level"
TIMEOUT_S = 5
NO_COPY_RECHECK_S = 10  # sans copie, on retente plus souvent

_POLES = ("motors", "equipment", "all")
_EMPTY_YEAR = {
    "needs_by_branch_brand": {p: {"source": "none", "rows": [], "postponed": []} for p in _POLES},
    "unchosen_modules": {p: {"catalog_available": False, "modules": []} for p in _POLES},
    "catalog_levels": {"lines": []},
}


@dataclass
class NeedsData:
    """Besoins résolus. `by_country` : code pays → besoins ; `by_cell` :
    (code pays, code marque) → (besoins, techniciens ou None)."""

    available: bool = False
    source: str = "none"
    by_country: dict[str, int] = field(default_factory=dict)
    by_cell: dict[tuple[str, str], tuple[int, int | None]] = field(default_factory=dict)
    # (code pays, code marque, code module normalisé) → places reportées.
    postponed: dict[tuple[str, str, str], int] = field(default_factory=dict)
    warnings: list[dict] = field(default_factory=list)


# ── Copie locale : rafraîchissement ──────────────────────────────────────────

_refresh_lock = threading.Lock()
_clock = {"checked_at": None, "reachable": True}


def reset_refresh_clock() -> None:
    """Oublie le dernier passage (tests, ou après un changement connu)."""
    _clock["checked_at"], _clock["reachable"] = None, True


def refresh_from_needs() -> str:
    """GET conditionnel du snapshot ; applied / unchanged / unavailable / invalid / disabled."""
    base = getattr(settings, "NEEDS_API_URL", "").rstrip("/")
    key = getattr(settings, "NEEDS_ANALYTICS_KEY", "")
    if not base or not key:
        return "disabled"
    _clock["checked_at"] = time.monotonic()
    known = known_version()
    headers = {"X-Analytics-Key": key}
    if known is not None:
        headers["If-None-Match"] = f'"v{known}"'
    timeout = float(getattr(settings, "NEEDS_SNAPSHOT_TIMEOUT_S", 2))
    try:
        response = requests.get(f"{base}{SNAPSHOT}", headers=headers, timeout=timeout)
    except requests.RequestException as exc:
        log.warning("cfao-needs injoignable (%s) : %s", SNAPSHOT, exc)
        _clock["reachable"] = False
        return "unavailable"
    if response.status_code == 304:
        _clock["reachable"] = True
        return "unchanged"
    if response.status_code != 200:
        log.warning("cfao-needs %s : HTTP %s", SNAPSHOT, response.status_code)
        _clock["reachable"] = False
        return "unavailable"
    try:
        applied = apply_snapshot(response.json(), PULL)
    except (SnapshotInvalid, ValueError) as exc:
        log.error("copie des besoins refusée (document invalide : %s)", exc)
        _clock["reachable"] = False
        return "invalid"
    _clock["reachable"] = True
    return "applied" if applied else "unchanged"


def _due(has_copy: bool) -> bool:
    checked = _clock["checked_at"]
    if checked is None:
        return True
    recheck = float(getattr(settings, "NEEDS_SNAPSHOT_RECHECK_S", 300))
    return time.monotonic() - checked >= (recheck if has_copy else min(recheck, NO_COPY_RECHECK_S))


def _refresh_in_background() -> None:
    if not _refresh_lock.acquire(blocking=False):
        return  # un passage est déjà en cours

    def run():
        try:
            refresh_from_needs()
        except Exception:  # un rafraîchissement raté ne doit jamais casser une lecture
            log.exception("rafraîchissement de la copie des besoins en échec")
        finally:
            connections.close_all()  # connexions de CE fil seulement
            _refresh_lock.release()
    threading.Thread(target=run, name="needs-snapshot-refresh", daemon=True).start()


def _year_copy(year: int) -> tuple[dict | None, list[dict]]:
    """Lectures de l'année dans la copie, et l'avertissement à joindre."""
    has_copy = known_version() is not None
    if _due(has_copy):
        if has_copy and getattr(settings, "NEEDS_SNAPSHOT_BACKGROUND", True):
            _refresh_in_background()
        else:
            with _refresh_lock:
                refresh_from_needs()
    state = NeedsCopyState.objects.filter(pk=1).first()
    if state is None or state.version is None:
        return None, [{"code": "needs_unavailable"}]
    row = NeedsCopyYear.objects.filter(year=year).first()
    warnings = [] if _clock["reachable"] else [
        {"code": "needs_snapshot_stale", "value": state.generated_at.isoformat()}]
    return (row.payload if row else _EMPTY_YEAR), warnings


def _by_pole(year_payload: dict, kind: str, pole: str) -> dict:
    by_pole = year_payload[kind]
    return by_pole.get(pole.lower()) or by_pole["all"]


def fetch_needs(year: int, pole: str) -> NeedsData:
    year_payload, warnings = _year_copy(year)
    if year_payload is None:
        return NeedsData(warnings=warnings)
    data = _parse_needs(_by_pole(year_payload, "needs_by_branch_brand", pole))
    data.warnings = warnings + data.warnings
    return data


def _parse_needs(payload: dict) -> NeedsData:
    data = NeedsData(available=True, source=payload["source"])
    resolver = Resolver()
    unknown: set[tuple[str, str]] = set()
    for row in payload["rows"]:
        country = resolver.country(row["country"])
        brand = resolver.brand(row["brand"])
        if country is None:
            unknown.add(("country", row["country"]))
            continue
        if brand is None:
            unknown.add(("brand", row["brand"]))
            continue
        code, brand_code = country.obj.code, brand.obj.code
        data.by_country[code] = data.by_country.get(code, 0) + row["needs"]
        needs, techs = data.by_cell.get((code, brand_code), (0, None))
        if row["technicians"] is not None:
            techs = (techs or 0) + row["technicians"]
        data.by_cell[(code, brand_code)] = (needs + row["needs"], techs)
    for row in payload.get("postponed", []):
        country, brand = resolver.country(row["country"]), resolver.brand(row["brand"])
        if country is None or brand is None:  # déjà signalé par la ligne de besoins
            continue
        module = (country.obj.code, brand.obj.code, norm_code(row["code"]))
        data.postponed[module] = data.postponed.get(module, 0) + row["places"]
    data.warnings = [{"code": f"unknown_{kind}", "value": value} for kind, value in sorted(unknown)]
    return data


def fetch_unchosen(year: int, pole: str) -> dict:
    year_payload, warnings = _year_copy(year)
    if year_payload is None:
        return {"available": False, "catalog_available": False, "modules": [], "warnings": warnings}
    payload = _by_pole(year_payload, "unchosen_modules", pole)
    return {"available": True, "catalog_available": payload["catalog_available"],
            "modules": payload["modules"], "warnings": warnings}


# ── Niveau des modules : le catalogue de cfao-needs est la seule source ───────

# Les paliers communs ne servent qu'à ranger le barème propre à chaque marque.
_TIER_RANK = {"JUNIOR": 0, "SENIOR": 1, "EXPERT": 2}


@dataclass(frozen=True)
class ModuleLevel:
    """Niveau d'un module : `label` dans le barème de la marque, `scale` ce barème."""

    label: str
    tier: str | None
    order: int
    line_ids: tuple[str, ...]
    scale: tuple[str, ...]
    family: str = ""


@dataclass
class CatalogLevels:
    available: bool = False
    modules: dict[tuple[str, str], ModuleLevel] = field(default_factory=dict)

    def module(self, brand_code: str, code_norm: str) -> ModuleLevel | None:
        return self.modules.get((brand_code, code_norm))


class CatalogUnavailable(Exception):
    pass


class CatalogLevelRejected(Exception):
    pass


class CatalogLevelConflict(Exception):
    def __init__(self, current: str):
        super().__init__("Niveau modifié entre-temps.")
        self.current = current


def _brand_scale(lines: list[dict]) -> tuple[str, ...]:
    """Libellés d'une marque, du premier palier au dernier puis dans l'ordre du catalogue."""
    tiers: dict[str, Counter] = defaultdict(Counter)
    first: dict[str, int] = {}
    for line in lines:
        label = line["level_label"]
        if label:
            tiers[label][line["tier"]] += 1
            first[label] = min(first.get(label, line["sort_order"]), line["sort_order"])
    def rank(label: str) -> tuple:
        tier = tiers[label].most_common(1)[0][0]
        return (_TIER_RANK.get(tier, len(_TIER_RANK)), first[label], label)
    return tuple(sorted(tiers, key=rank))


def fetch_catalog_levels(year: int) -> CatalogLevels:
    year_payload, _ = _year_copy(year)
    if year_payload is None:
        return CatalogLevels()
    return _parse_catalog_levels(year_payload["catalog_levels"])


def _parse_catalog_levels(payload: dict) -> CatalogLevels:
    resolver = Resolver()
    by_brand: dict[str, list[dict]] = defaultdict(list)
    by_module: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for line in payload["lines"]:
        brand = resolver.brand(line["brand"])
        if brand is None:
            continue
        by_brand[brand.obj.code].append(line)
        by_module[(brand.obj.code, norm_code(line["code"]))].append(line)
    scales = {code: _brand_scale(lines) for code, lines in by_brand.items()}
    modules = {}
    for (brand_code, code), lines in by_module.items():
        scale, label = scales[brand_code], lines[0]["level_label"]
        modules[(brand_code, code)] = ModuleLevel(
            label=label, tier=lines[0]["tier"],
            order=scale.index(label) if label else len(scale),
            line_ids=tuple(line["id"] for line in lines), scale=scale,
            family=lines[0].get("family", ""),
        )
    return CatalogLevels(available=True, modules=modules)


def update_catalog_level(line_ids: tuple[str, ...], expected: str, label: str) -> dict:
    """Écrit le niveau au catalogue. `expected` : la valeur vue à l'écran."""
    base = getattr(settings, "NEEDS_API_URL", "").rstrip("/")
    key = getattr(settings, "NEEDS_CATALOG_WRITE_KEY", "")
    if not base or not key:
        raise CatalogUnavailable
    try:
        response = requests.post(f"{base}{CATALOG_LEVEL}", timeout=TIMEOUT_S,
                                 headers={"X-Catalog-Write-Key": key},
                                 json={"line_ids": list(line_ids), "expected": expected, "level_label": label})
    except requests.RequestException as exc:
        log.warning("cfao-needs injoignable (%s) : %s", CATALOG_LEVEL, exc)
        raise CatalogUnavailable from exc
    if response.status_code == 200:
        # L'écran relit le niveau aussitôt : la copie doit déjà le contenir.
        with _refresh_lock:
            refresh_from_needs()
        return response.json()
    if response.status_code == 409:
        raise CatalogLevelConflict(response.json().get("current", ""))
    if response.status_code == 400:
        raise CatalogLevelRejected
    log.warning("cfao-needs %s : HTTP %s", CATALOG_LEVEL, response.status_code)
    raise CatalogUnavailable
