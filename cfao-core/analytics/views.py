"""Analytics — endpoints de reporting global.

Ressources non scopées : accès réservé aux rôles groupe (superadmin, group_admin,
group_hr). Cerbos gate l'action `read` sur la ressource `group_stats`.
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authz.permissions import CerbosPermission

from .services import VALID_BUS, group_stats


class GroupStatsView(APIView):
    """GET /api/v1/core/analytics/group-stats[?bu=all|equipment|motors]

    Snapshot MEDACAP + cfao-needs pour le hero Super Admin. `bu` filtre
    `learnerCount` et `brandCount` sur le champ `department` (Mongo `users`).
    Un `bu` inconnu est rejeté en 400 plutôt que dégradé silencieusement.

    Réponse :
        {
          "bu":            "equipment",
          "learnerCount":  181,       # techniciens (avec BU si demandé)
          "branchCount":   12,        # filiales — non filtré (une filiale = 2 BU en général)
          "brandCount":    11,        # marques distinctes du périmètre BU
          "trainingCount": 180,       # sessions programmées `trainingYear` (cfao-needs)
          "trainingYear":  2026
        }
    """

    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "group_stats"
    cerbos_action = "read"

    def get_cerbos_target(self, request):
        # Ressource globale (pas de périmètre org).
        return "*", {}

    def get(self, request):
        bu = (request.query_params.get("bu") or "all").strip().lower()
        if bu not in VALID_BUS:
            return Response(
                {"detail": f"bu must be one of {sorted(VALID_BUS)}"},
                status=400,
            )
        return Response(group_stats(bu))
