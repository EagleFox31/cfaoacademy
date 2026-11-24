"""Calendrier annuel de formation : la grille « Plannings formateurs » relue telle quelle.

Lecture seule des bandes importées (`GridBand`) : une ligne par formateur (marques,
formateur) dans l'ordre de la grille, les bandes de chaque ligne et les jours fériés.
Rien n'est rapproché du prévisionnel : l'écran montre ce que montre la grille.
"""
from __future__ import annotations

import re

from referential.resolve import Resolver

from ..imports.forecast_grid import HOLIDAY_FILL, HOLIDAY_SECTION, KIND_BY_FILL
from ..models import GridBand
from .forecast_schedule import _countries_by_loose, _resolve, parse_band

# Lignes de bas de bloc, toujours présentes dans la grille, même vides.
TAIL_SECTIONS = ("FORMATIONS REPORTEES", "FORMATIONS ANNULEES")
_ROW = re.compile(r"(\d+)$")


def _row(cell: str) -> int:
    found = _ROW.search(cell or "")
    return int(found.group(1)) if found else 0


def _line_key(band: GridBand) -> str:
    return f"{band.section}|{band.trainer_raw}".lower()


def _merge(order: list[str], month_lines: list[str]) -> list[str]:
    """Ajoute les lignes d'un mois à l'ordre connu : une ligne nouvelle se place
    juste après celle qui la précède dans ce mois (même disposition d'un mois à l'autre)."""
    for index, key in enumerate(month_lines):
        if key in order:
            continue
        before = next((k for k in reversed(month_lines[:index]) if k in order), None)
        order.insert(order.index(before) + 1 if before else 0, key)
    return order


def _settle(order: list[str], months: list[list[str]]) -> list[str]:
    """Remet l'ordre d'aplomb sur l'ensemble des mois : une ligne passe avant une autre
    si elle la précède dans la majorité des mois où les deux figurent (une ligne vue
    d'abord sans sa voisine du dessus ne garde pas une place fausse)."""
    ahead: dict[tuple[str, str], int] = {}
    for seen in months:
        for i, a in enumerate(seen):
            for b in seen[i + 1:]:
                ahead[a, b] = ahead.get((a, b), 0) + 1
    rest, out = list(order), []
    while rest:
        pick = next((x for x in rest if not any(ahead.get((y, x), 0) > ahead.get((x, y), 0)
                                                   for y in rest if y != x)), rest[0])
        out.append(pick)
        rest.remove(pick)
    return out


def _trainer_name(resolver: Resolver, raw: str, cache: dict) -> str:
    """Nom complet du référentiel (la grille ne donne souvent que le prénom), sinon le texte brut."""
    if raw not in cache:
        match = resolver.trainer(raw) if raw else None
        cache[raw] = match.obj.full_name if match else raw
    return cache[raw]


def _pole_calendar(bands: list[GridBand]) -> dict:
    lines: dict[str, dict] = {}
    by_month: dict[int, list[tuple[int, str]]] = {}
    holidays, out = set(), []
    resolver, loose, names = Resolver(), _countries_by_loose(), {}
    for band in bands:
        if band.section == HOLIDAY_SECTION:
            holidays.add(band.start_date.isoformat())
            continue
        key = _line_key(band)
        lines.setdefault(key, {"key": key, "section": band.section, "brands": band.brands_raw,
                               "trainer": band.trainer_raw,
                               "trainer_name": _trainer_name(resolver, band.trainer_raw, names)})
        by_month.setdefault(band.start_date.month, []).append((_row(band.cell), key))
        country, brand = _resolve(resolver, parse_band(band.text, set()).segments, loose)
        out.append({
            "line": key, "start": band.start_date.isoformat(), "end": band.end_date.isoformat(),
            "text": band.text, "title": band.title, "kind": KIND_BY_FILL[band.fill_key],
            "country": country.code if country else None,
            "country_label": country.label if country else None,
            "brand": brand.label if brand else None,
        })
    order: list[str] = []
    months = []
    for month in sorted(by_month):
        seen = []
        for _, key in sorted(by_month[month]):
            if key not in seen:
                seen.append(key)
        months.append(seen)
        _merge(order, seen)
    order = _settle(order, months)
    # Reportées puis annulées ferment chaque mois, comme dans la grille.
    order = [k for k in order if lines[k]["section"] not in TAIL_SECTIONS]
    for section in TAIL_SECTIONS:
        key = f"{section}|".lower()
        lines.setdefault(key, {"key": key, "section": section, "brands": "", "trainer": "",
                               "trainer_name": ""})
        order.append(key)
    return {"lines": [lines[k] for k in order], "bands": out, "holidays": sorted(holidays)}


def training_calendar(year: int, pole: str) -> dict:
    bands = list(GridBand.objects.filter(year=year, pole=pole)
                 .filter(fill_key__in=[*KIND_BY_FILL, HOLIDAY_FILL])
                 .order_by("start_date", "cell"))
    data = _pole_calendar(bands) if bands else {"lines": [], "bands": [], "holidays": []}
    return {"year": year, "pole": pole, "empty": not bands, **data}
