"""Vues de restitution de la clé (SPEC §8, sorties) : tableau global pays × marque
(feuille MOTORS GLOBAL du classeur) et fiche par pays (feuilles pays).

Lecture seule. Les montants par pays viennent de `cost_key.compute` (ou du
snapshot pour le prévu d'une clé gelée) : ce module ne recalcule aucune part, il
ventile les places par marque et place les besoins reçus de cfao-needs.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal
from functools import reduce

from django.conf import settings

from ..clients.needs import CatalogLevels, ModuleLevel, NeedsData, fetch_catalog_levels
from ..models import INACTIVE_STATUSES, CostKeyYear, PlannedAllocation, ReviewItem, SeatAllocation
from .cost_key import (
    CostKeyReport,
    Mode,
    compute,
    is_academy_site,
    session_has_trainer_lodging,
    seat_price,
)


# Où vont les places attribuées. Une place reportée reste comptée et facturée.
IN_SUBSIDIARY, AT_ACADEMY, POSTPONED = "in_subsidiary", "at_academy", "postponed"
PLACE_KEYS = (IN_SUBSIDIARY, AT_ACADEMY, POSTPONED)


def _num(value):
    """Decimal → nombre JSON : entier pour les montants au franc, réel sinon."""
    if value is None:
        return None
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    return value


def _ratio(seats: int, needs: int | None):
    return round(seats / needs, 4) if needs else None


def report_for(key: CostKeyYear, mode: Mode, needs: dict[str, int] | None) -> CostKeyReport:
    """Le prévu d'une clé gelée se lit dans son snapshot : c'est la base facturée."""
    if mode == Mode.PLANNED and key.is_frozen:
        report = CostKeyReport.from_dict(key.snapshot.report)
        for line in report.lines:
            line.needs = (needs or {}).get(line.code)
            line.coverage = Decimal(line.seats) / line.needs if line.needs else None
        return report
    return compute(key, needs, mode=mode)


def _allocations(key: CostKeyYear, mode: Mode):
    if mode == Mode.PLANNED:
        return (PlannedAllocation.objects.filter(planned_session__cost_key=key)
                .select_related("country", "planned_session__brand", "planned_session__country"),
                "planned_session")
    return (SeatAllocation.objects.filter(session__year=key.year, session__brand__pole=key.pole)
            .exclude(session__status__in=INACTIVE_STATUSES)
            .select_related("country", "session__brand", "session__country"),
            "session")


def seats_by_cell(key: CostKeyYear, mode: Mode) -> tuple[dict[tuple[str, str], int], dict[str, str]]:
    allocations, parent = _allocations(key, mode)
    cells: dict[tuple[str, str], int] = defaultdict(int)
    brands: dict[str, str] = {}
    for a in allocations:
        brand = getattr(a, parent).brand
        if brand is None:
            continue
        brands[brand.code] = brand.label
        cells[(a.country.code, brand.code)] += a.seats
    return cells, brands


def _postponed_seats(allocations, parent: str, postponed: dict) -> dict:
    """Places reportées de chaque allocation : le report d'un module va sur ses
    sessions les plus tardives."""
    remaining = dict(postponed)
    seats = {}
    for a in sorted(allocations, key=lambda a: getattr(a, parent).start_date or date.min, reverse=True):
        session = getattr(a, parent)
        module = (a.country.code, session.brand.code if session.brand else "", session.code_norm)
        taken = min(a.seats, remaining.get(module, 0))
        if taken:
            seats[a.pk] = taken
            remaining[module] -= taken
    return seats


def places_by_country(key: CostKeyYear, mode: Mode, postponed: dict) -> dict[str, dict[str, int]]:
    allocations, parent = _allocations(key, mode)
    allocations = list(allocations)
    reported = _postponed_seats(allocations, parent, postponed)
    places: dict[str, dict[str, int]] = defaultdict(lambda: dict.fromkeys(PLACE_KEYS, 0))
    for a in allocations:
        site = AT_ACADEMY if is_academy_site(getattr(a, parent)) else IN_SUBSIDIARY
        places[a.country.code][site] += a.seats - reported.get(a.pk, 0)
        places[a.country.code][POSTPONED] += reported.get(a.pk, 0)
    return places


def review_items(key: CostKeyYear, visible: set[str] | None = None) -> list[dict]:
    """Incohérences de source encore ouvertes sur cette clé, limitées aux pays du lecteur."""
    items = ReviewItem.objects.filter(status=ReviewItem.Status.OPEN,
                                      reason=ReviewItem.Reason.SOURCE_INCONSISTENT,
                                      proposed__cost_key=str(key.id))
    fields = ("country", "country_label", "code", "seats", "start_date", "end_date", "issue", "assignee")
    return [{"id": str(item.id), **{f: item.proposed.get(f) for f in fields}}
            for item in items if visible is None or item.proposed.get("country") in visible]


def _responses(pole: str, answered, known, visible: set[str] | None) -> dict:
    """Filiales d'un pôle ayant répondu au recueil des besoins (au moins 1 place
    demandée), parmi celles que la clé connaît. Limité au périmètre du lecteur."""
    seen = lambda codes: sorted(c for c in codes if visible is None or c in visible)
    return {"pole": pole, "answered": seen(answered), "known": seen(known)}


def global_table(key: CostKeyYear, mode: Mode, needs: NeedsData,
                 visible: set[str] | None = None) -> dict:
    """`visible` : codes pays que le lecteur peut voir (None = tous)."""
    report = report_for(key, mode, needs.by_country if needs.available else None)
    cells, brands = seats_by_cell(key, mode)
    places = places_by_country(key, mode, needs.postponed)
    for (_, brand_code) in needs.by_cell:
        brands.setdefault(brand_code, brand_code.upper())
    brand_order = sorted(brands, key=lambda c: brands[c])

    rows = []
    brand_totals = {b: {"needs": 0, "technicians": 0, "seats": 0} for b in brand_order}
    for line in report.lines:
        if visible is not None and line.code not in visible:
            continue
        row_cells, technicians = {}, None
        for b in brand_order:
            cell_needs, techs = needs.by_cell.get((line.code, b), (None, None))
            seats = cells.get((line.code, b), 0)
            row_cells[b] = {"needs": cell_needs, "technicians": techs, "seats": seats,
                            "coverage": _ratio(seats, cell_needs)}
            if techs is not None:
                technicians = (technicians or 0) + techs
            total = brand_totals[b]
            total["needs"] += cell_needs or 0
            total["technicians"] += techs or 0
            total["seats"] += seats
        rows.append({
            "country": line.code, "label": line.label, "enrolled": line.enrolled,
            "technicians": technicians, "needs": line.needs, "seats": line.seats,
            **{k: places[line.code][k] for k in PLACE_KEYS},
            "coverage": _num(round(line.coverage, 4)) if line.coverage is not None else None,
            "share": float(round(line.share, 6)), "key_cost": _num(line.key_cost),
            "trainee_lodging": _num(line.trainee_lodging),
            "trainer_lodging": _num(line.trainer_lodging), "total": _num(line.total),
            "cells": row_cells,
        })
    for total in brand_totals.values():
        total["coverage"] = _ratio(total["seats"], total["needs"])

    answered = {code for code, count in needs.by_country.items() if count}
    known = answered | {line.code for line in report.lines}
    return {
        "year": key.year, "pole": key.pole, "mode": str(mode), "status": key.status,
        "responses": [_responses(key.pole, answered, known, visible)],
        "budget": _num(report.budget), "total_seats": report.total_seats,
        "hourly_cost": None if report.hourly_cost is None else round(float(report.hourly_cost), 2),
        "hourly_rate": _num(key.hourly_rate),
        "needs_source": needs.source, "warnings": needs.warnings,
        "review_items": review_items(key, visible),
        "brands": [{"code": b, "label": brands[b]} for b in brand_order],
        "brand_totals": brand_totals, "rows": rows, "partial": visible is not None,
    }


ALL_POLES = "ALL"


def _add(a, b):
    """Somme qui garde « inconnu » (None) tant qu'aucune des deux valeurs n'est connue."""
    if a is None:
        return b
    return a if b is None else a + b


def _merge_cell(a: dict | None, b: dict) -> dict:
    if a is None:
        return dict(b)
    cell = {k: _add(a[k], b[k]) for k in ("needs", "technicians")}
    cell["seats"] = a["seats"] + b["seats"]
    cell["coverage"] = _ratio(cell["seats"], cell["needs"])
    return cell


def consolidate(tables: list[dict], visible: set[str] | None = None) -> dict:
    """Vue « tous pôles » d'une année : les tableaux globaux de chaque pôle
    (calculés SANS filtre de pays) additionnés pays par pays.

    Montants, places et besoins s'additionnent ; la part d'un pays est son total
    sur le total général ; le coût d'une heure n'a pas de sens (un par pôle) : None.
    Le filtre `visible` s'applique après le calcul, pour que les parts restent
    celles de l'ensemble des pays.
    """
    rows: dict[str, dict] = {}
    brands: dict[str, str] = {}
    for table in tables:
        brands.update({b["code"]: b["label"] for b in table["brands"]})
        for r in table["rows"]:
            acc = rows.get(r["country"])
            if acc is None:
                rows[r["country"]] = {**r, "cells": {b: dict(c) for b, c in r["cells"].items()}}
                continue
            acc["enrolled"] = acc["enrolled"] or r["enrolled"]
            for k in ("technicians", "needs", "key_cost", "trainee_lodging",
                      "trainer_lodging", "total"):
                acc[k] = _add(acc[k], r[k])
            for k in ("seats", *PLACE_KEYS):
                acc[k] += r[k]
            for b, c in r["cells"].items():
                acc["cells"][b] = _merge_cell(acc["cells"].get(b), c)

    brand_order = sorted(brands, key=lambda c: brands[c])
    grand_total = sum(r["total"] or 0 for r in rows.values())
    ordered = []
    for code in [r["country"] for t in tables for r in t["rows"]]:
        row = rows.pop(code, None)
        if row is None:
            continue
        row["coverage"] = _ratio(row["seats"], row["needs"])
        row["share"] = round((row["total"] or 0) / grand_total, 6) if grand_total else 0.0
        for b in brand_order:
            row["cells"].setdefault(b, {"needs": None, "technicians": None, "seats": 0,
                                        "coverage": None})
        if visible is None or code in visible:
            ordered.append(row)

    brand_totals = {}
    for b in brand_order:
        total = {k: sum(r["cells"][b][k] or 0 for r in ordered)
                 for k in ("needs", "technicians", "seats")}
        total["coverage"] = _ratio(total["seats"], total["needs"])
        brand_totals[b] = total

    sources = {t["needs_source"] for t in tables}
    return {
        "year": tables[0]["year"], "pole": ALL_POLES, "poles": [t["pole"] for t in tables],
        "mode": tables[0]["mode"],
        "responses": [_responses(r["pole"], r["answered"], r["known"], visible)
                      for t in tables for r in t["responses"]],
        "status": "FROZEN" if all(t["status"] == "FROZEN" for t in tables) else "DRAFT",
        "budget": sum(t["budget"] or 0 for t in tables),
        "total_seats": sum(t["total_seats"] for t in tables), "hourly_cost": None,
        "hourly_rate": None,
        "needs_source": sources.pop() if len(sources) == 1 else "mixed",
        "warnings": [w for t in tables for w in t["warnings"]],
        "review_items": [r for t in tables for r in t["review_items"]],
        "brands": [{"code": b, "label": brands[b]} for b in brand_order],
        "brand_totals": brand_totals, "rows": ordered, "partial": visible is not None,
    }


# Après tous les barèmes : un module sans niveau connu ferme la marque.
NO_LEVEL_ORDER = 999


def _session_order(row: dict) -> tuple:
    """Marque, niveau, code, date : les lignes d'un même niveau restent contiguës à l'écran."""
    return (row["brand"], row["level_order"], row["code"], str(row["start_date"] or ""))


def consolidate_sheet(sheets: list[dict], row: dict) -> dict:
    """Fiche « tous pôles » d'un pays : ses sessions de chaque pôle, et le pied
    repris de la ligne consolidée (`row`, issue de `consolidate`)."""
    sessions = sorted((s for sh in sheets for s in sh["sessions"]), key=_session_order)
    first = sheets[0]
    return {
        "year": first["year"], "pole": ALL_POLES, "mode": first["mode"],
        "status": "FROZEN" if all(s["status"] == "FROZEN" for s in sheets) else "DRAFT",
        "country": row["country"], "label": row["label"], "enrolled": row["enrolled"],
        "sessions": sessions,
        "footer": {k: row[k] for k in ("seats", "share", "key_cost", "trainee_lodging", "trainer_lodging",
                                       "total", "needs", "coverage", *PLACE_KEYS)},
    }


ALL_COUNTRIES = "all"


# Métier visé par une formation, déduit de sa famille dans le catalogue de cfao-needs.
JOB_BY_FAMILY = {
    "techniques-motors": "TECHNICIAN", "techniques-equipment": "TECHNICIAN",
    "process-sav-motors": "SAV", "process-sav-equipment": "SAV",
    "techniques-carrosserie": "BODY",
    "process-parts-motors": "PARTS", "process-parts-equipment": "PARTS",
    "conduite-equipment": "DRIVER",
}


def all_countries_sheet(table: dict, sheets: list[dict]) -> dict:
    """Devis « toutes les filiales » : les lignes de chaque fiche, filiale après filiale. Le pied
    vient du tableau global, qui compte aussi les besoins des filiales encore sans place."""
    rows = table["rows"]
    def total(field):
        return reduce(_add, (r[field] for r in rows), None)
    seats = sum(r["seats"] for r in rows)
    needs = total("needs")
    return {
        "year": table["year"], "pole": table["pole"], "mode": table["mode"], "status": table["status"],
        "country": ALL_COUNTRIES, "label": ALL_COUNTRIES, "enrolled": any(r["enrolled"] for r in rows),
        "sessions": [{**s, "country": sh["country"], "country_label": sh["label"]}
                     for sh in sheets for s in sh["sessions"]],
        "footer": {
            "seats": seats, "share": round(sum(r["share"] for r in rows), 6),
            **{k: total(k) for k in ("key_cost", "trainee_lodging", "trainer_lodging", "total", "needs")},
            "coverage": _ratio(seats, needs),
            "needs_by_brand": ({b: v["needs"] for b, v in table["brand_totals"].items()}
                               if needs is not None else None),
            **{k: sum(r[k] for r in rows) for k in PLACE_KEYS},
        },
    }


def _edit_block(key: CostKeyYear, session, allocation, mode: Mode, module: ModuleLevel | None) -> dict:
    """Ce qu'il faut au tableur pour modifier la ligne : identifiants et valeurs brutes."""
    if mode != Mode.PLANNED:
        return {}
    return {"edit": {
        "key": str(key.pk), "frozen": key.is_frozen,
        "session": str(session.pk), "allocation": str(allocation.pk),
        "levels": list(module.scale) if module else None,
        "raw": {
            "seats": allocation.seats,
            "start_date": session.start_date.isoformat() if session.start_date else None,
            "end_date": session.end_date.isoformat() if session.end_date else None,
            "location": session.location, "title": session.title,
            "level": module.label if module else "",
        },
    }}


def country_sheet(key: CostKeyYear, mode: Mode, country_code: str,
                  needs: dict[str, int] | None = None,
                  levels: CatalogLevels | None = None,
                  postponed: dict | None = None,
                  needs_by_brand: dict[str, int] | None = None) -> dict | None:
    """Sessions où le pays a des places, et le pied de feuille (coût clé,
    hébergements, total). None si le pays est inconnu de la clé. `levels` évite de
    relire le catalogue quand plusieurs fiches sont produites d'affilée."""
    report = report_for(key, mode, needs)
    line = next((l for l in report.lines if l.code == country_code), None)
    if line is None:
        return None
    allocations, parent = _allocations(key, mode)
    allocations = allocations.filter(country__code=country_code)
    if mode == Mode.PLANNED:
        allocations = allocations.prefetch_related("planned_session__trainers",
                                                   "planned_session__country")
    else:
        allocations = allocations.prefetch_related("session__assignments__trainer",
                                                   "session__country")
    price = seat_price(key) if line.enrolled else None
    levels = levels if levels is not None else fetch_catalog_levels(key.year)
    reported = _postponed_seats(allocations, parent, postponed or {})
    places = dict.fromkeys(PLACE_KEYS, 0)
    sessions = []
    for a in allocations:
        s = getattr(a, parent)
        people = (list(s.trainers.all()) if mode == Mode.PLANNED
                  else [x.trainer for x in s.assignments.all()])
        # Même règle que `compute`, ligne par ligne : une somme filtrée reste juste.
        academy = is_academy_site(s)
        trainee = (a.seats * key.trainee_lodging_cost
                   if academy and country_code != settings.ACADEMY_COUNTRY_CODE else Decimal(0))
        trainer = (key.trainer_lodging_cost
                   if s.country.code == country_code and session_has_trainer_lodging(s, people)
                   else Decimal(0))
        module = levels.module(s.brand.code if s.brand else "", s.code_norm)
        site = AT_ACADEMY if academy else IN_SUBSIDIARY
        postponed_seats = reported.get(a.pk, 0)
        places[site] += a.seats - postponed_seats
        places[POSTPONED] += postponed_seats
        sessions.append({
            "brand": s.brand.label if s.brand else "",
            "brand_code": s.brand.code if s.brand else "",
            "level": (module.label or None) if module else None,
            "level_tier": module.tier if module else None,
            "level_order": module.order if module else NO_LEVEL_ORDER,
            "in_catalog": module is not None,
            "job": JOB_BY_FAMILY.get(module.family) if module else None,
            # Le prévu ne porte pas ce champ, seules les sessions réalisées l'ont.
            "delivery": getattr(s, "delivery_mode", None) or None,
            "code": s.code_raw or s.code_norm,
            "title": s.title, "start_date": s.start_date, "end_date": s.end_date,
            # Une session chargée sans lien au référentiel garde le nom lu dans le classeur.
            "trainers": ", ".join(t.full_name for t in people) or getattr(s, "trainers_raw", ""),
            "location": s.location or s.country.label,
            "host": s.country.code, "seats": a.seats,
            "site": site, "seat_status": POSTPONED if postponed_seats else site, "postponed": postponed_seats,
            # Clé tarifée seulement : taux horaire × heures de session × techniciens.
            "key_cost": _num(a.seats * price) if price is not None else None,
            "trainee_lodging": _num(trainee), "trainer_lodging": _num(trainer),
            **_edit_block(key, s, a, mode, module),
        })
    sessions.sort(key=_session_order)
    return {
        "year": key.year, "pole": key.pole, "mode": str(mode), "status": key.status,
        "country": line.code, "label": line.label, "enrolled": line.enrolled,
        "sessions": sessions,
        "footer": {
            "seats": line.seats, "share": float(round(line.share, 6)),
            "key_cost": _num(line.key_cost), "trainee_lodging": _num(line.trainee_lodging),
            "trainer_lodging": _num(line.trainer_lodging), "total": _num(line.total),
            "needs": line.needs,
            "coverage": None if line.coverage is None else float(round(line.coverage, 4)),
            # Par marque : ce qui reste juste quand l'écran n'affiche qu'une partie de la filiale.
            "needs_by_brand": needs_by_brand if line.needs is not None else None,
            **places,
        },
    }
