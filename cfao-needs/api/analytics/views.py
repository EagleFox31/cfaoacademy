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
from django.db.models import Q, Sum
from django.views.decorators.http import require_GET
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.decorators import api_view, authentication_classes, permission_classes

from campaigns.models import BranchBrandQuota, CourseAllocation, TrainingSession


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
