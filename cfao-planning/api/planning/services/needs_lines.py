"""Besoins de la copie rangés en lignes, une fois pour toutes à la réception.

La copie (`NeedsCopyYear.payload`) garde le document tel que cfao-needs l'a
envoyé. Ses libellés bruts (pays, marque) sont résolus ICI, par les alias du
référentiel, puis écrits dans `NeedsPole`, `NeedsLine` et `NeedsModuleLine`. Les
calculs lisent ces lignes (`resolved_needs`) au lieu de reparser le JSON à
chaque lecture.

`sync_needs_lines` compare l'attendu à l'existant et n'écrit que la différence :
sur une base à jour, zéro écriture (démarrage idempotent, AGENTS.md §7). Elle
tourne dans la transaction de `apply_snapshot`, et après un changement d'alias.
"""
from __future__ import annotations

from django.db import transaction

from ..models import NeedsCopyState, NeedsCopyYear, NeedsLine, NeedsModuleLine, NeedsPole
from .needs_copy import POLES

# Site d'une place attribuée sur la fiche → genre de la ligne rangée, et retour.
ASSIGNED_KIND = {"academy": NeedsModuleLine.Kind.AT_ACADEMY, "subsidiary": NeedsModuleLine.Kind.IN_SUBSIDIARY,
                 "distance": NeedsModuleLine.Kind.AT_DISTANCE}
SITE_OF_KIND = {str(kind): site for site, kind in ASSIGNED_KIND.items()}


def _wanted():
    """Lignes attendues d'après la copie : (en-têtes, cellules, modules), par clé unique."""
    from referential.models import Brand, Country
    from referential.resolve import Resolver

    from ..clients.needs import _parse_needs

    resolver = Resolver()
    poles, cells, modules = {}, {}, {}
    # code → pk, pour écrire les clés étrangères
    pk = {**{("country", c): p for c, p in Country.objects.values_list("code", "pk")},
          **{("brand", c): p for c, p in Brand.objects.values_list("code", "pk")}}
    for copy in NeedsCopyYear.objects.all():
        by_pole = copy.payload.get("needs_by_branch_brand", {})
        for pole in POLES:
            if pole not in by_pole:
                continue
            data = _parse_needs(by_pole[pole], resolver)
            poles[(copy.year, pole)] = (data.source, data.warnings)
            for (country, brand), (needs, techs) in data.by_cell.items():
                cells[(copy.year, pole, pk["country", country], pk["brand", brand])] = (needs, techs)
            for kind, target in ((NeedsModuleLine.Kind.POSTPONED, data.postponed),
                                 (NeedsModuleLine.Kind.UNASSIGNED, data.unassigned)):
                for (country, brand, code), places in target.items():
                    modules[(copy.year, pole, str(kind), pk["country", country], pk["brand", brand], code)] = places
            for (country, brand, code, site), places in data.assigned.items():
                kind = str(ASSIGNED_KIND[site])
                modules[(copy.year, pole, kind, pk["country", country], pk["brand", brand], code)] = places
    return poles, cells, modules


def _sync(model, fields, key_of, value_of, wanted, build) -> int:
    """Aligne une table sur `wanted` ({clé: valeur}) ; renvoie le nombre de lignes écrites."""
    existing = {key_of(row): row for row in model.objects.all()}
    stale = [row.pk for key, row in existing.items() if key not in wanted]
    if stale:
        model.objects.filter(pk__in=stale).delete()
    missing = [build(key, value) for key, value in wanted.items() if key not in existing]
    if missing:
        model.objects.bulk_create(missing)
    changed = []
    for key, value in wanted.items():
        row = existing.get(key)
        if row is not None and value_of(row) != value:
            for name, v in zip(fields, value if isinstance(value, tuple) else (value,)):
                setattr(row, name, v)
            changed.append(row)
    if changed:
        model.objects.bulk_update(changed, fields)
    return len(stale) + len(missing) + len(changed)


def sync_needs_lines() -> int:
    """Range la copie en lignes ; nombre de lignes écrites (0 si déjà à jour). Les sessions
    « fiche » des clés en préparation suivent les lignes (`sheet_sessions`)."""
    from .sheet_sessions import sync_sheet_sessions

    poles, cells, modules = _wanted()
    with transaction.atomic():
        return _sync_tables(poles, cells, modules) + sync_sheet_sessions()


def _sync_tables(poles, cells, modules) -> int:
    with transaction.atomic():
        return (
            _sync(NeedsPole, ["source", "warnings"], lambda r: (r.year, r.pole),
                  lambda r: (r.source, r.warnings), poles,
                  lambda k, v: NeedsPole(year=k[0], pole=k[1], source=v[0], warnings=v[1]))
            + _sync(NeedsLine, ["needs", "technicians"],
                    lambda r: (r.year, r.pole, r.country_id, r.brand_id),
                    lambda r: (r.needs, r.technicians), cells,
                    lambda k, v: NeedsLine(year=k[0], pole=k[1], country_id=k[2], brand_id=k[3],
                                           needs=v[0], technicians=v[1]))
            + _sync(NeedsModuleLine, ["places"],
                    lambda r: (r.year, r.pole, r.kind, r.country_id, r.brand_id, r.code_norm),
                    lambda r: r.places, modules,
                    lambda k, v: NeedsModuleLine(year=k[0], pole=k[1], kind=k[2], country_id=k[3],
                                                 brand_id=k[4], code_norm=k[5], places=v))
        )


ensure_needs_lines = sync_needs_lines


def resolved_needs(year: int, pole: str):
    """Besoins résolus d'une année et d'un pôle, lus dans les lignes (aucun rafraîchissement).

    Même résultat que l'analyse du JSON de la copie : pôle absent → repli sur
    « all », année absente → aucune donnée mais disponible, aucune copie → indisponible.
    """
    from ..clients.needs import NeedsData

    state = NeedsCopyState.objects.filter(pk=1).first()
    if state is None or state.version is None:
        return NeedsData(warnings=[{"code": "needs_unavailable"}])
    header = (NeedsPole.objects.filter(year=year, pole=pole.lower()).first()
              or NeedsPole.objects.filter(year=year, pole="all").first())
    if header is None:
        return NeedsData(available=True, source="none")
    data = NeedsData(available=True, source=header.source, warnings=list(header.warnings))
    lines = (NeedsLine.objects.filter(year=year, pole=header.pole)
             .select_related("country", "brand").order_by("id"))
    for line in lines:
        code = line.country.code
        data.by_country[code] = data.by_country.get(code, 0) + line.needs
        data.by_cell[(code, line.brand.code)] = (line.needs, line.technicians)
    targets = {NeedsModuleLine.Kind.POSTPONED: data.postponed, NeedsModuleLine.Kind.UNASSIGNED: data.unassigned}
    for m in (NeedsModuleLine.objects.filter(year=year, pole=header.pole)
              .select_related("country", "brand").order_by("id")):
        module = (m.country.code, m.brand.code, m.code_norm)
        if m.kind in SITE_OF_KIND:
            data.assigned[(*module, SITE_OF_KIND[m.kind])] = m.places
        else:
            targets[m.kind][module] = m.places
    return data
