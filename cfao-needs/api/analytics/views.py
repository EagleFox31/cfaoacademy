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
from django.db import connection
from django.views.decorators.http import require_GET
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.decorators import api_view, authentication_classes, permission_classes


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

    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT ca.country, SUM(ca.allocated_seats) AS seats
              FROM campaigns_courseallocation ca
              JOIN campaigns_campaign c ON c.id = ca.campaign_id
             WHERE c.year = %s
               AND ca.country NOT ILIKE 'TOTAL%%'
               AND ca.country NOT ILIKE 'PLACÉES%%'
               AND ca.country NOT ILIKE 'RESTE%%'
             GROUP BY ca.country
             ORDER BY seats DESC
            """,
            (year,),
        )
        rows = cur.fetchall()

    return Response({
        "year": year,
        "allocations": [
            {"country": country, "seats": int(seats or 0)}
            for country, seats in rows
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

    pole_filter = ""
    params: list = [year]
    if bu == "equipment":
        pole_filter = "AND bq.pole = 'EQUIPMENT'"
    elif bu == "motors":
        pole_filter = "AND bq.pole = 'MOTORS'"

    with connection.cursor() as cur:
        cur.execute(
            f"""
            SELECT COALESCE(SUM(total_branch_techs), 0)
              FROM (
                SELECT DISTINCT bq.pole, bq.country, bq.total_branch_techs
                  FROM campaigns_branchbrandquota bq
                  JOIN campaigns_campaign c ON c.id = bq.campaign_id
                 WHERE c.year = %s
                   {pole_filter}
              ) t
            """,
            params,
        )
        row = cur.fetchone()
        count = int(row[0]) if row else 0

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

    with connection.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM campaigns_trainingsession WHERE year = %s",
            (year,),
        )
        row = cur.fetchone()
        count = int(row[0]) if row else 0

    return Response({"year": year, "count": count})
