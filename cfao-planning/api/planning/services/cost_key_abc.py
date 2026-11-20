"""Vue « ABC » de la clé : les trois bases de répartition du classeur MOTORS GLOBAL.

- A, Attribué : places effectivement attribuées (le prévu de la clé, colonne Z) ;
- B, Besoin : places demandées par la filiale (cfao-needs, colonne X) ;
- C, Contractuel : techniciens que le contrat impose (cfao-needs, colonne Y).

Pour chaque base : la part d'un pays (X / somme des X) et le montant (budget × part,
colonnes AD-AF), réparti à l'unité près sur les pays enrôlés. Lecture seule : la
facturation reste celle de la clé (base A).
"""
from __future__ import annotations

from decimal import Decimal

from referential.models import Brand, Country

from ..clients.needs import NeedsData
from ..models import CostKeyYear
from .cost_key import Mode, allocate
from .cost_key_global import seats_by_cell

BASES = ("a", "b", "c")


def _num(value: Decimal | None):
    if value is None:
        return None
    return int(value) if value == value.to_integral_value() else float(value)


def _ratio(x, y):
    return round(x / y, 4) if x is not None and y else None


def _finish(rows: list[dict], key: CostKeyYear, enrolled: set[str], available: bool) -> Decimal:
    """Parts et montants de chaque base, sur les pays enrôlés. Renvoie le budget
    effectif de la base A (celui de la clé, ou places × prix si elle est tarifée)."""
    budget_a = key.budget
    for base in BASES:
        if base != "a" and not available:
            for r in rows:
                r[f"share_{base}"] = r[f"amount_{base}"] = None
            continue
        weights = {r["country"]: r[base] or 0 for r in rows if r["country"] in enrolled}
        total = sum(weights.values())
        amounts, budget = allocate(key, weights)
        if base == "a":
            budget_a = budget
        for r in rows:
            w = weights.get(r["country"])
            r[f"share_{base}"] = round(w / total, 6) if w is not None and total else 0.0
            r[f"amount_{base}"] = _num(amounts.get(r["country"], Decimal(0)))
    return budget_a


def abc_table(key: CostKeyYear, needs: NeedsData, visible: set[str] | None = None) -> dict:
    """`visible` : codes pays lisibles (None = tous). Les parts sont calculées sur
    l'ensemble des pays, puis filtrées : un lecteur restreint voit les vraies parts."""
    cells, brands = seats_by_cell(key, Mode.PLANNED)
    enrolled = set(key.enrolled_countries.values_list("code", flat=True))
    codes = enrolled | {c for c, _ in cells} | {c for c, _ in needs.by_cell}
    labels = dict(Country.objects.filter(code__in=codes).values_list("code", "label"))
    brand_codes = set(brands) | {b for _, b in needs.by_cell}
    brands.update(Brand.objects.filter(code__in=brand_codes).values_list("code", "label"))
    brand_order = sorted(brand_codes, key=lambda b: brands.get(b, b))

    rows = []
    for code in codes:
        row_cells, a, b, c = {}, 0, None, None
        for brand in brand_order:
            seats = cells.get((code, brand), 0)
            cell_b, cell_c = needs.by_cell.get((code, brand), (None, None))
            if not needs.available:
                cell_b = cell_c = None
            row_cells[brand] = {"a": seats, "b": cell_b, "c": cell_c,
                                "a_b": _ratio(seats, cell_b), "a_c": _ratio(seats, cell_c)}
            a += seats
            if cell_b is not None:
                b = (b or 0) + cell_b
            if cell_c is not None:
                c = (c or 0) + cell_c
        rows.append({"country": code, "label": labels.get(code, code.upper()),
                     "enrolled": code in enrolled, "a": a, "b": b, "c": c,
                     "a_b": _ratio(a, b), "a_c": _ratio(a, c), "cells": row_cells})
    rows.sort(key=lambda r: (not r["enrolled"], r["label"]))
    budget = _finish(rows, key, enrolled, needs.available)

    shown = [r for r in rows if visible is None or r["country"] in visible]
    totals = {base: sum(r[base] or 0 for r in shown) for base in BASES}
    return {
        "year": key.year, "pole": key.pole, "status": key.status, "budget": _num(budget),
        "needs_source": needs.source, "warnings": needs.warnings,
        "brands": [{"code": b, "label": brands.get(b, b.upper())} for b in brand_order],
        "totals": totals, "rows": shown, "partial": visible is not None,
    }


def consolidate_abc(tables: list[dict], visible: set[str] | None = None) -> dict:
    """ABC « tous pôles » d'une année : quantités et montants additionnés pays par
    pays (tableaux calculés SANS filtre), parts recalculées sur le total général."""
    merged: dict[str, dict] = {}
    brands: dict[str, str] = {}
    for table in tables:
        brands.update({b["code"]: b["label"] for b in table["brands"]})
        for r in table["rows"]:
            acc = merged.setdefault(r["country"], {
                "country": r["country"], "label": r["label"], "enrolled": False,
                "a": 0, "b": None, "c": None, "cells": {},
                **{f"amount_{x}": None for x in BASES}})
            acc["enrolled"] = acc["enrolled"] or r["enrolled"]
            acc["a"] += r["a"]
            for x in ("b", "c"):
                if r[x] is not None:
                    acc[x] = (acc[x] or 0) + r[x]
            for x in BASES:
                if r[f"amount_{x}"] is not None:
                    acc[f"amount_{x}"] = (acc[f"amount_{x}"] or 0) + r[f"amount_{x}"]
            acc["cells"].update(r["cells"])
    rows = sorted(merged.values(), key=lambda r: (not r["enrolled"], r["label"]))
    for x in BASES:
        total = sum(r[f"amount_{x}"] or 0 for r in rows)
        for r in rows:
            amount = r[f"amount_{x}"]
            r[f"share_{x}"] = None if amount is None else (round(amount / total, 6) if total else 0.0)
    for r in rows:
        r["a_b"], r["a_c"] = _ratio(r["a"], r["b"]), _ratio(r["a"], r["c"])
    brand_order = sorted(brands, key=lambda b: brands[b])
    empty = {"a": 0, "b": None, "c": None, "a_b": None, "a_c": None}
    for r in rows:
        for b in brand_order:
            r["cells"].setdefault(b, dict(empty))
    shown = [r for r in rows if visible is None or r["country"] in visible]
    sources = {t["needs_source"] for t in tables}
    return {
        "year": tables[0]["year"], "pole": "ALL", "poles": [t["pole"] for t in tables],
        "status": "FROZEN" if all(t["status"] == "FROZEN" for t in tables) else "DRAFT",
        "budget": sum(t["budget"] or 0 for t in tables),
        "needs_source": sources.pop() if len(sources) == 1 else "mixed",
        "warnings": [w for t in tables for w in t["warnings"]],
        "brands": [{"code": b, "label": brands[b]} for b in brand_order],
        "totals": {x: sum(r[x] or 0 for r in shown) for x in BASES},
        "rows": shown, "partial": visible is not None,
    }
