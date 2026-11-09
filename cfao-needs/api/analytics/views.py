"""Endpoints d'agrégation cfao-needs pour reporting cross-service.

Ces vues sont **service-to-service** (appelées par cfao-core → dashboard super
admin), pas par un utilisateur du portail. Authentification par shared key
plutôt que JWT+Cerbos : le PDP Cerbos n'a pas de principal humain à évaluer,
et créer un service-account JWT pour un simple `SELECT COUNT(*)` serait
disproportionné.

En prod : `NEEDS_ANALYTICS_INBOUND_KEY` vient du Key Vault, jamais du dépôt.
"""
from datetime import date

from django.conf import settings
from django.db.models import F, Q, Sum
from django.views.decorators.http import require_GET
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.decorators import api_view, authentication_classes, permission_classes

from campaigns.models import (
    BranchBrandQuota, CatalogLine, CourseAllocation, NeedLine, Submission, TrainingSession,
)


def _check_shared_key(request) -> None:
    """Fail-close : rejette si la clé partagée est absente ou incorrecte.

    Côté serveur, un secret non configuré = tout est refusé (jamais un « allow »
    silencieux). On log au niveau warning et on renvoie 401.
    """
    expected = getattr(settings, "ANALYTICS_INBOUND_KEY", "") or ""
    provided = request.META.get("HTTP_X_ANALYTICS_KEY", "")
    if not expected or not provided or expected != provided:
        raise AuthenticationFailed("invalid_analytics_key")


@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
@require_GET
def allocations_per_branch(request):
    """GET /api/v1/needs/analytics/allocations-per-branch?year=YYYY

    Renvoie les places allouées par pays pour la campagne de l'année. La table
    `campaigns_courseallocation` contient à la fois des vraies allocations par
    pays et des lignes récapitulatives Excel (`TOTAL DEMANDÉES`, `PLACÉES AU
    CAMEROUN`, `RESTE À PLACER`, …) qu'on filtre côté requête.

    Réponse :
        {
          "year": 2026,
          "allocations": [
            {"country": "TOGO", "seats": 264},
            {"country": "COTE D'IVOIRE", "seats": 178},
            ...
          ]
        }

    Erreurs :
        401 si header X-Analytics-Key manquant/invalide
        400 si `year` non entier
    """
    _check_shared_key(request)

    raw_year = request.query_params.get("year")
    try:
        year = int(raw_year) if raw_year is not None else date.today().year
    except (TypeError, ValueError):
        return Response({"detail": "year must be an integer"}, status=400)

    summary_rows = Q()
    for prefix in CourseAllocation.SUMMARY_ROW_PREFIXES:
        summary_rows |= Q(country__istartswith=prefix)
    rows = (
        CourseAllocation.objects.filter(campaign__year=year)
        .exclude(summary_rows)
        .values("country")
        .annotate(seats=Sum("allocated_seats"))
        .order_by("-seats", "country")
    )

    return Response({
        "year": year,
        "allocations": [
            {"country": row["country"], "seats": int(row["seats"] or 0)}
            for row in rows
        ],
    })


@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
@require_GET
def total_technicians(request):
    """GET /api/v1/needs/analytics/total-technicians?bu=equipment|motors|all

    Renvoie le nombre réel de techniciens CFAO pour l'année en cours, issu de
    la Clé de Répartition (table campaigns_branchbrandquota). Source de vérité
    métier : chaque filiale déclare ses effectifs par pôle lors de la campagne.

    La somme est calculée sur les paires (pole, country) distinctes pour éviter
    de compter N fois le même effectif pays une fois par marque.

    Réponse :
        {"bu": "equipment", "year": 2026, "count": 392}

    Erreurs :
        401 si header X-Analytics-Key manquant/invalide
        400 si `year` non entier
    """
    _check_shared_key(request)

    raw_year = request.query_params.get("year")
    try:
        year = int(raw_year) if raw_year is not None else date.today().year
    except (TypeError, ValueError):
        return Response({"detail": "year must be an integer"}, status=400)

    bu = (request.query_params.get("bu") or "all").strip().lower()
    if bu not in ("equipment", "motors", "all"):
        bu = "all"

    quotas = BranchBrandQuota.objects.filter(campaign__year=year)
    if bu != "all":
        quotas = quotas.filter(pole=bu.upper())
    branches = quotas.values_list("pole", "country", "total_branch_techs").distinct()
    count = sum(total for _, _, total in branches)

    return Response({"bu": bu, "year": year, "count": count})


@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
@require_GET
def scheduled_trainings(request):
    """GET /api/v1/needs/analytics/scheduled-trainings?year=YYYY

    Renvoie le nombre de sessions programmées pour l'année demandée. Y'a-t-il
    lieu de le pré-agréger ? Pas au volume actuel (180/an) — un `SELECT COUNT`
    sur une table indexée coûte moins que le round-trip HTTP lui-même.

    Réponse :
        {"year": 2026, "count": 180}

    Erreurs :
        401 si header X-Analytics-Key manquant/invalide
        400 si `year` non entier
    """
    _check_shared_key(request)

    raw_year = request.query_params.get("year")
    try:
        year = int(raw_year) if raw_year is not None else date.today().year
    except (TypeError, ValueError):
        return Response({"detail": "year must be an integer"}, status=400)

    count = TrainingSession.objects.filter(year=year).count()

    return Response({"year": year, "count": count})


# Pôle du contrat → pôle des quotas importés (clé de répartition) et pôle du
# catalogue (le code catalogue de Motors reste `MOBILITY`, referential.Pole).
_QUOTA_POLE = {"motors": "MOTORS", "equipment": "EQUIPMENT"}
_CATALOG_POLE = {"motors": "MOBILITY", "equipment": "EQUIPMENT"}


def _year_and_pole(request):
    raw_year = request.query_params.get("year")
    try:
        year = int(raw_year) if raw_year is not None else date.today().year
    except (TypeError, ValueError):
        return None, None
    pole = (request.query_params.get("pole") or "all").strip().lower()
    return year, pole if pole in _QUOTA_POLE else "all"


def _validated_lines(year: int, pole: str):
    lines = NeedLine.objects.filter(
        submission__campaign__year=year, submission__status=Submission.Status.VALIDATED,
    )
    if pole != "all":
        lines = lines.filter(catalog_line__family__pole=_CATALOG_POLE[pole])
    return lines


@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
@require_GET
def needs_by_branch_brand(request):
    """GET /api/v1/needs/analytics/needs-by-branch-brand?year=YYYY&pole=motors

    Besoins et techniciens par pays et par marque : l'entrée du taux de
    couverture de la clé de répartition (cfao-planning).

    - `needs` : somme q1..q4 des fiches VALIDÉES. Sans aucune fiche validée sur
      l'année et le pôle, repli sur les besoins de la clé importée
      (`BranchBrandQuota.requested_needs`). `source` dit lequel a servi.
    - `technicians` : effectif de la marque dans la clé importée, null sinon.
    - Pays et marques en libellés bruts : le consommateur les résout par ses alias.
    """
    _check_shared_key(request)
    year, pole = _year_and_pole(request)
    if year is None:
        return Response({"detail": "year must be an integer"}, status=400)

    quotas = BranchBrandQuota.objects.filter(campaign__year=year)
    if pole != "all":
        quotas = quotas.filter(pole=_QUOTA_POLE[pole])
    rows: dict[tuple[str, str], dict] = {}
    for q in quotas:
        row = rows.setdefault((q.country, q.brand), {
            "country": q.country, "brand": q.brand, "needs": 0, "technicians": 0})
        row["needs"] += q.requested_needs
        row["technicians"] += q.brand_tech_count

    submitted = (
        _validated_lines(year, pole).exclude(catalog_line__brand__isnull=True)
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

    return Response({
        "year": year, "pole": pole, "source": source,
        "rows": sorted(rows.values(), key=lambda r: (r["country"], r["brand"])),
    })


@api_view(["GET"])
@authentication_classes([])
@permission_classes([])
@require_GET
def unchosen_modules(request):
    """GET /api/v1/needs/analytics/unchosen-modules?year=YYYY&pole=motors

    Modules du catalogue de l'année qu'aucune fiche validée n'a demandés : une
    marque peu demandée reste visible (SPEC planning §8, sorties).
    `catalog_available` est faux quand l'année n'a pas de catalogue : une liste
    vide ne veut alors pas dire « tout a été choisi ».
    """
    _check_shared_key(request)
    year, pole = _year_and_pole(request)
    if year is None:
        return Response({"detail": "year must be an integer"}, status=400)

    catalog = CatalogLine.objects.filter(campaign__year=year).select_related("family", "brand")
    if pole != "all":
        catalog = catalog.filter(family__pole=_CATALOG_POLE[pole])
    chosen = (
        _validated_lines(year, pole)
        .annotate(total=F("q1") + F("q2") + F("q3") + F("q4"))
        .filter(total__gt=0).values_list("catalog_line_id", flat=True)
    )
    modules = catalog.exclude(pk__in=chosen).order_by("family__pole", "brand__label", "sort_order",
                                                      "code")
    return Response({
        "year": year, "pole": pole, "catalog_available": catalog.exists(),
        "modules": [
            {"pole": m.family.pole, "brand": m.brand.label if m.brand else None,
             "tier": m.tier or None, "code": m.code, "title": m.title}
            for m in modules
        ],
    })
