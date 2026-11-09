"""Consommateur du contrat `needs-analytics` (contracts/registry.json, `^1.1`).

Les besoins et les thématiques non choisies viennent de cfao-needs, jamais d'une
ressaisie. Les libellés bruts (pays, marque) sont résolus par les alias du
référentiel ; un libellé inconnu est **signalé**, jamais compté à 0. Si cfao-needs
ne répond pas, les besoins valent None et un avertissement le dit : un taux de
couverture vide vaut mieux qu'un taux faux.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

import requests
from django.conf import settings

from referential.resolve import Resolver

log = logging.getLogger(__name__)

NEEDS_BY_BRANCH_BRAND = "/api/v1/needs/analytics/needs-by-branch-brand"
UNCHOSEN_MODULES = "/api/v1/needs/analytics/unchosen-modules"
TIMEOUT_S = 5


@dataclass
class NeedsData:
    """Besoins résolus. `by_country` : code pays → besoins ; `by_cell` :
    (code pays, code marque) → (besoins, techniciens ou None)."""

    available: bool = False
    source: str = "none"
    by_country: dict[str, int] = field(default_factory=dict)
    by_cell: dict[tuple[str, str], tuple[int, int | None]] = field(default_factory=dict)
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
    data.warnings = [{"code": f"unknown_{kind}", "value": value} for kind, value in sorted(unknown)]
    return data


def fetch_unchosen(year: int, pole: str) -> dict:
    payload = _get(UNCHOSEN_MODULES, {"year": year, "pole": pole.lower()})
    if payload is None:
        return {"available": False, "catalog_available": False, "modules": [],
                "warnings": [{"code": "needs_unavailable"}]}
    return {"available": True, "catalog_available": payload["catalog_available"],
            "modules": payload["modules"], "warnings": []}
