"""Vues de restitution de la clé (SPEC §8, sorties) : tableau global pays × marque
(feuille MOTORS GLOBAL du classeur) et fiche par pays (feuilles pays).

Lecture seule. Les montants par pays viennent de `cost_key.compute` (ou du
snapshot pour le prévu d'une clé gelée) : ce module ne recalcule aucune part, il
ventile les places par marque et place les besoins reçus de cfao-needs.
"""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from django.conf import settings

from ..clients.needs import NeedsData
from ..models import INACTIVE_STATUSES, CostKeyYear, PlannedAllocation, SeatAllocation
from .cost_key import CostKeyReport, Mode, compute, is_academy_site, needs_trainer_lodging


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
                .select_related("country", "planned_session__brand"),
                "planned_session")
    return (SeatAllocation.objects.filter(session__year=key.year, session__brand__pole=key.pole)
            .exclude(session__status__in=INACTIVE_STATUSES)
            .select_related("country", "session__brand"),
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


def global_table(key: CostKeyYear, mode: Mode, needs: NeedsData,
                 visible: set[str] | None = None) -> dict:
    """`visible` : codes pays que le lecteur peut voir (None = tous)."""
    report = report_for(key, mode, needs.by_country if needs.available else None)
    cells, brands = seats_by_cell(key, mode)
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
            "coverage": _num(round(line.coverage, 4)) if line.coverage is not None else None,
            "share": float(round(line.share, 6)), "key_cost": _num(line.key_cost),
            "trainee_lodging": _num(line.trainee_lodging),
            "trainer_lodging": _num(line.trainer_lodging), "total": _num(line.total),
            "cells": row_cells,
        })
    for total in brand_totals.values():
        total["coverage"] = _ratio(total["seats"], total["needs"])

    return {
        "year": key.year, "pole": key.pole, "mode": str(mode), "status": key.status,
        "budget": _num(report.budget), "total_seats": report.total_seats,
        "hourly_cost": None if report.hourly_cost is None else round(float(report.hourly_cost), 2),
        "hourly_rate": _num(key.hourly_rate),
        "needs_source": needs.source, "warnings": needs.warnings,
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
            acc["seats"] += r["seats"]
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
        "status": "FROZEN" if all(t["status"] == "FROZEN" for t in tables) else "DRAFT",
        "budget": sum(t["budget"] or 0 for t in tables),
        "total_seats": sum(t["total_seats"] for t in tables), "hourly_cost": None,
        "hourly_rate": None,
        "needs_source": sources.pop() if len(sources) == 1 else "mixed",
        "warnings": [w for t in tables for w in t["warnings"]],
        "brands": [{"code": b, "label": brands[b]} for b in brand_order],
        "brand_totals": brand_totals, "rows": ordered, "partial": visible is not None,
    }


def consolidate_sheet(sheets: list[dict], row: dict) -> dict:
    """Fiche « tous pôles » d'un pays : ses sessions de chaque pôle, et le pied
    repris de la ligne consolidée (`row`, issue de `consolidate`)."""
    sessions = sorted((s for sh in sheets for s in sh["sessions"]),
                      key=lambda r: (r["brand"], r["code"], str(r["start_date"] or "")))
    first = sheets[0]
    return {
        "year": first["year"], "pole": ALL_POLES, "mode": first["mode"],
        "status": "FROZEN" if all(s["status"] == "FROZEN" for s in sheets) else "DRAFT",
        "country": row["country"], "label": row["label"], "enrolled": row["enrolled"],
        "sessions": sessions,
        "footer": {k: row[k] for k in ("seats", "share", "key_cost", "trainee_lodging",
                                       "trainer_lodging", "total", "needs", "coverage")},
    }


def country_sheet(key: CostKeyYear, mode: Mode, country_code: str,
                  needs: dict[str, int] | None = None) -> dict | None:
    """Sessions où le pays a des places, et le pied de feuille (coût clé,
    hébergements, total). None si le pays est inconnu de la clé."""
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
                   if not academy and s.country.code == country_code
                   and any(needs_trainer_lodging(t, s) for t in people) else Decimal(0))
        sessions.append({
            "brand": s.brand.label if s.brand else "", "code": s.code_raw or s.code_norm,
            "title": s.title, "start_date": s.start_date, "end_date": s.end_date,
            "trainers": ", ".join(t.full_name for t in people),
            "location": s.location or s.country.label,
            "host": s.country.code, "seats": a.seats,
            "trainee_lodging": _num(trainee), "trainer_lodging": _num(trainer),
        })
    sessions.sort(key=lambda r: (r["brand"], r["code"], str(r["start_date"] or "")))
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
        },
    }
