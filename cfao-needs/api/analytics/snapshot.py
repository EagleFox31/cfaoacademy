"""Corps des réponses analytics de la clé de répartition, et leur snapshot versionné.

Les vues (lecture à la demande) et le relais vers cfao-planning (copie poussée)
construisent les mêmes corps : une seule définition, donc une seule vérité.

La version est tenue par un trigger SQL (migration `analytics.0002`) : toute
transaction qui touche une donnée lue ici l'incrémente une fois, à son commit.
Le snapshot lit la version AVANT les données, dans une même photographie de la
base (REPEATABLE READ) : une copie marquée `v` contient au moins tout ce qui a
été validé jusqu'à `v`.
"""
from __future__ import annotations

from django.db import connection, transaction
from django.db.models import F, Sum
from django.utils import timezone

from campaigns.models import BranchBrandQuota, Campaign, CatalogLine, NeedLine, Submission

from .models import NeedsState

# Pôle du contrat → pôle des quotas importés (clé de répartition) et pôle du
# catalogue (le code catalogue de Motors reste `MOBILITY`, referential.Pole).
QUOTA_POLE = {"motors": "MOTORS", "equipment": "EQUIPMENT"}
CATALOG_POLE = {"motors": "MOBILITY", "equipment": "EQUIPMENT"}
POLES = ("motors", "equipment", "all")

# Même ordre en lecture et en écriture : la ligne affichée est celle qui fait foi.
LEVEL_ORDER = ("brand__label", "sort_order", "code")


def validated_lines(year: int, pole: str):
    lines = NeedLine.objects.filter(
        submission__campaign__year=year, submission__status=Submission.Status.VALIDATED,
    )
    if pole != "all":
        lines = lines.filter(catalog_line__family__pole=CATALOG_POLE[pole])
    return lines


def needs_by_branch_brand_body(year: int, pole: str) -> dict:
    quotas = BranchBrandQuota.objects.filter(campaign__year=year)
    if pole != "all":
        quotas = quotas.filter(pole=QUOTA_POLE[pole])
    rows: dict[tuple[str, str], dict] = {}
    for q in quotas:
        row = rows.setdefault((q.country, q.brand), {
            "country": q.country, "brand": q.brand, "needs": 0, "technicians": 0})
        row["needs"] += q.requested_needs
        row["technicians"] += q.brand_tech_count

    submitted = (
        validated_lines(year, pole).exclude(catalog_line__brand__isnull=True)
        .values("submission__country", "catalog_line__brand__label")
        .annotate(total=Sum(F("q1") + F("q2") + F("q3") + F("q4")))
    )
    source = "none"
    if submitted:
        source = "submissions"
        for row in rows.values():
            row["needs"] = 0
        for s in submitted:
            key = (s["submission__country"], s["catalog_line__brand__label"])
            row = rows.setdefault(key, {"country": key[0], "brand": key[1], "needs": 0,
                                        "technicians": None})
            row["needs"] += int(s["total"] or 0)
    elif rows:
        source = "quota_import"

    postponed = (
        validated_lines(year, pole).filter(postponed__gt=0).exclude(catalog_line__brand__isnull=True)
        .values("submission__country", "catalog_line__brand__label", "catalog_line__code")
        .annotate(places=Sum("postponed"))
        .order_by("submission__country", "catalog_line__brand__label", "catalog_line__code")
    )
    return {
        "year": year, "pole": pole, "source": source,
        "rows": sorted(rows.values(), key=lambda r: (r["country"], r["brand"])),
        "postponed": [
            {"country": p["submission__country"], "brand": p["catalog_line__brand__label"],
             "code": p["catalog_line__code"], "places": p["places"]}
            for p in postponed
        ],
    }


def unchosen_modules_body(year: int, pole: str) -> dict:
    catalog = CatalogLine.objects.filter(campaign__year=year).select_related("family", "brand")
    if pole != "all":
        catalog = catalog.filter(family__pole=CATALOG_POLE[pole])
    chosen = (
        validated_lines(year, pole)
        .annotate(total=F("q1") + F("q2") + F("q3") + F("q4"))
        .filter(total__gt=0).values_list("catalog_line_id", flat=True)
    )
    modules = catalog.exclude(pk__in=chosen).order_by("family__pole", "brand__label", "sort_order",
                                                      "code")
    return {
        "year": year, "pole": pole, "catalog_available": catalog.exists(),
        "modules": [
            {"pole": m.family.pole, "brand": m.brand.label if m.brand else None,
             "tier": m.tier or None, "code": m.code, "title": m.title}
            for m in modules
        ],
    }


def catalog_levels_body(year: int) -> dict:
    lines = (CatalogLine.objects.filter(campaign__year=year, brand__isnull=False)
             .select_related("brand", "family").order_by(*LEVEL_ORDER))
    return {
        "year": year, "catalog_available": lines.exists(),
        "lines": [
            {"id": str(line.pk), "brand": line.brand.label, "code": line.code, "family": line.family.key,
             "level_label": line.level_label, "tier": line.tier or None, "sort_order": line.sort_order}
            for line in lines
        ],
    }


def current_version() -> int:
    """0 tant qu'aucune modification n'a été comptée (base neuve ou antérieure au trigger)."""
    return NeedsState.objects.filter(pk=1).values_list("version", flat=True).first() or 0


def build_snapshot() -> dict:
    """Toutes les années de campagne, chaque pôle : ce que cfao-planning lit de cfao-needs."""
    outermost = not connection.in_atomic_block  # sinon la transaction englobante est déjà ouverte
    with transaction.atomic():
        if outermost and connection.vendor == "postgresql":
            with connection.cursor() as cursor:
                cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        version = current_version()  # en premier : voir la docstring du module
        years = {}
        for year in Campaign.objects.order_by("year").values_list("year", flat=True):
            years[str(year)] = {
                "needs_by_branch_brand": {p: needs_by_branch_brand_body(year, p) for p in POLES},
                "unchosen_modules": {p: unchosen_modules_body(year, p) for p in POLES},
                "catalog_levels": catalog_levels_body(year),
            }
    return {"version": version, "generated_at": timezone.now().isoformat(), "years": years}
