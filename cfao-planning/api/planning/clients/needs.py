"""Consommateur du contrat `needs-analytics` (contracts/registry.json, `^1.3`).

Les besoins et les thématiques non choisies viennent de cfao-needs, jamais d'une
ressaisie. Les libellés bruts (pays, marque) sont résolus par les alias du
référentiel ; un libellé inconnu est **signalé**, jamais compté à 0. Si cfao-needs
ne répond pas, les besoins valent None et un avertissement le dit : un taux de
couverture vide vaut mieux qu'un taux faux.
"""
from __future__ import annotations

import logging
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import requests
from django.conf import settings

from referential.normalize import norm_code
from referential.resolve import Resolver

log = logging.getLogger(__name__)

NEEDS_BY_BRANCH_BRAND = "/api/v1/needs/analytics/needs-by-branch-brand"
UNCHOSEN_MODULES = "/api/v1/needs/analytics/unchosen-modules"
CATALOG_LEVELS = "/api/v1/needs/analytics/catalog-levels"
CATALOG_LEVEL = "/api/v1/needs/analytics/catalog-level"
TIMEOUT_S = 5


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


def _get(path: str, params: dict) -> dict | None:
    base = getattr(settings, "NEEDS_API_URL", "").rstrip("/")
    key = getattr(settings, "NEEDS_ANALYTICS_KEY", "")
    if not base or not key:
        return None
    try:
        response = requests.get(f"{base}{path}", params=params,
                                headers={"X-Analytics-Key": key}, timeout=TIMEOUT_S)
    except requests.RequestException as exc:
        log.warning("cfao-needs injoignable (%s) : %s", path, exc)
        return None
    if response.status_code != 200:
        log.warning("cfao-needs %s : HTTP %s", path, response.status_code)
        return None
    return response.json()


def fetch_needs(year: int, pole: str) -> NeedsData:
    payload = _get(NEEDS_BY_BRANCH_BRAND, {"year": year, "pole": pole.lower()})
    if payload is None:
        return NeedsData(warnings=[{"code": "needs_unavailable"}])
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
    payload = _get(UNCHOSEN_MODULES, {"year": year, "pole": pole.lower()})
    if payload is None:
        return {"available": False, "catalog_available": False, "modules": [],
                "warnings": [{"code": "needs_unavailable"}]}
    return {"available": True, "catalog_available": payload["catalog_available"],
            "modules": payload["modules"], "warnings": []}


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
    payload = _get(CATALOG_LEVELS, {"year": year})
    if payload is None:
        return CatalogLevels()
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
        return response.json()
    if response.status_code == 409:
        raise CatalogLevelConflict(response.json().get("current", ""))
    if response.status_code == 400:
        raise CatalogLevelRejected
    log.warning("cfao-needs %s : HTTP %s", CATALOG_LEVEL, response.status_code)
    raise CatalogUnavailable
