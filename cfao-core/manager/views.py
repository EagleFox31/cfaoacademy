"""Portail Chef d'équipe — endpoints MEDACAP scopés à l'équipe du manager.

L'endpoint lit l'identité de l'appelant via JWT (sub = username MEDACAP) puis
charge la portée équipe depuis `technicianBrandScores`. Le scope peut être
forcé avec `?username=` pour la démo super admin (Cerbos vérifie les roles).
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authz.permissions import CerbosPermission
from analytics.services import _db

from .services import manager_scope


def _resolve_manager_profile(username: str) -> dict | None:
    """Charge filiale + agence d'un utilisateur depuis MEDACAP.

    Cherche d'abord par username MEDACAP natif, puis par keycloakUsername
    (champ écrit par import_medacap_managers pour les comptes normalisés prenom.nom).
    """
    projection = {"subsidiary": 1, "agency": 1, "firstName": 1, "lastName": 1,
                  "department": 1, "country": 1}
    try:
        db = _db()
        u = db["users"].find_one({"username": username}, projection)
        if u:
            return u
        return db["users"].find_one({"keycloakUsername": username}, projection)
    except Exception:
        return None


class ManagerScopeView(APIView):
    """GET /api/v1/core/manager/scope[?username=…]

    Retourne les KPIs et membres d'équipe du chef d'équipe authentifié.
    Le scope est déterminé par subsidiary + agency de l'utilisateur.

    Réponse :
        {
          "subsidiary": "CAMEROON MOTORS INDUSTRIES",
          "agencyName": "Yaoundé",
          "technicianCount": 11,
          "brandCount": 7,
          "members": [...],
          "brandMatrix": [...],
          "kpis": {"avgScore":..., "scoredCount":..., "totalCount":..., "alertCount":...},
          "manager": {"firstName":..., "lastName":..., "agency":..., "country":...}
        }

    Erreurs :
        404 si le profil manager n'est pas trouvé en base
    """

    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "manager_scope"
    cerbos_action = "read"

    def get_cerbos_target(self, request):
        username = (
            request.query_params.get("username")
            or getattr(request.user, "username", None)
            or request.user.sub
        )
        return username, {"subsidiary": "*"}

    def get(self, request):
        username = (
            request.query_params.get("username")
            or getattr(request.user, "username", None)
            or request.user.sub
        )
        profile = _resolve_manager_profile(username)
        if not profile:
            return Response({"detail": "manager profile not found"}, status=404)

        subsidiary = profile.get("subsidiary") or ""
        agency = profile.get("agency") or None

        if not subsidiary:
            return Response({"detail": "user has no subsidiary"}, status=422)

        scope = manager_scope(subsidiary, agency)
        scope["manager"] = {
            "firstName": profile.get("firstName", ""),
            "lastName": profile.get("lastName", ""),
            "agency": agency or "",
            "country": profile.get("country", ""),
            "department": profile.get("department", ""),
        }
        return Response(scope)
