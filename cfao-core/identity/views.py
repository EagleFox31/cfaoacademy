"""Endpoint de référence /me — patron sécurisé que le générateur de module recopie.

Il traverse toute la chaîne : JWT Keycloak (authentication) → principal →
Cerbos check (permission, action `view:self` sur la ressource `account`) → réponse.
"""
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authz import cerbos
from core.authz.filters import DeniedAll, plan_to_q
from audit.services import record_audit
from core.authz.permissions import CerbosPermission
from .models import OrgUnit, RoleAssignment, User
from .serializers import AssignmentSerializer, OrgUnitSerializer, UserSerializer
from .services import resolve_principal


class MeView(APIView):
    """GET /api/v1/core/me — renvoie le principal résolu (id, rôles, périmètre)."""

    permission_classes = [IsAuthenticated, CerbosPermission]

    # Contrat attendu par CerbosPermission :
    cerbos_resource_kind = "account"
    cerbos_action = "view:self"

    def get_cerbos_target(self, request):
        user = request.user
        return user.id, {"orgPath": user.attr.get("orgPath", [])}

    def get(self, request):
        principal = request.user
        # v2 : le périmètre appartient à identity. Si le compte existe en base, on
        # résout depuis les affectations (source de vérité) ; sinon repli sur les claims.
        db_user = User.objects.filter(keycloak_sub=principal.id).first()
        if db_user:
            resolved = resolve_principal(db_user)
            return Response(
                {
                    "id": resolved["id"],
                    "source": "identity",
                    "roles": resolved["roles"],
                    "scopeNodes": resolved["attr"]["scopeNodes"],
                    "departments": resolved["attr"]["departments"],
                    "brands": resolved["attr"]["brands"],
                }
            )
        attr = principal.attr
        scope_node = attr.get("scopeNode", "")
        return Response(
            {
                "id": principal.id,
                "source": "token",
                "roles": principal.roles,
                "scopeNodes": [scope_node] if scope_node else [],
                "departments": attr.get("departments", []),
                "brands": attr.get("brands", []),
            }
        )


class OrgUnitViewSet(viewsets.ModelViewSet):
    """Arbre org (apps 11/12) — PEP Cerbos default-deny + liste filtrée par query plan."""

    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "org_unit"
    queryset = OrgUnit.objects.all()
    serializer_class = OrgUnitSerializer

    def get_cerbos_object(self, obj):
        return obj.code, {"orgPath": obj.path}

    def get_cerbos_target(self, request):
        # Création : l'unité naît sous son parent → on check contre le périmètre du parent.
        parent_id = (getattr(request, "data", {}) or {}).get("parent")
        if parent_id:
            parent = OrgUnit.objects.filter(pk=parent_id).first()
            if parent:
                return parent.code, {"orgPath": parent.path}
        return "*", {}

    def get_queryset(self):
        qs = super().get_queryset()
        if getattr(self, "action", None) != "list":
            return qs
        plan = cerbos.plan(self.request.user.to_cerbos(), self.cerbos_resource_kind, "list")
        try:
            return qs.filter(plan_to_q(plan, {"orgPath": "path"}))
        except DeniedAll:
            return qs.none()


class UserViewSet(viewsets.ModelViewSet):
    """Comptes (apps 11/12) — scope via `scope_paths` dénormalisé (union des affectations)."""

    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "user_account"
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_cerbos_object(self, obj):
        return obj.keycloak_sub, {"orgPath": obj.scope_paths}

    def get_queryset(self):
        qs = super().get_queryset()
        if getattr(self, "action", None) != "list":
            return qs
        plan = cerbos.plan(self.request.user.to_cerbos(), self.cerbos_resource_kind, "list")
        try:
            return qs.filter(plan_to_q(plan, {"orgPath": "scope_paths"}))
        except DeniedAll:
            return qs.none()

    @action(detail=True, methods=["get", "post"], url_path="assignments")
    def assignments(self, request, pk=None):
        """Gère les affectations d'un compte. Action custom → check Cerbos explicite.

        GET  : lister (autorisé si on peut voir le compte).
        POST : créer une affectation — contrôlée contre le PÉRIMÈTRE de l'unité ciblée
               (et non le scope actuel du compte, qui peut être vide). Recompute auto via signal.
        """
        user = get_object_or_404(User, pk=pk)
        principal = request.user.to_cerbos()

        if request.method.lower() == "get":
            if not cerbos.check(principal, "user_account", user.keycloak_sub, {"orgPath": user.scope_paths}, "view"):
                raise PermissionDenied()
            return Response(AssignmentSerializer(user.assignments.all(), many=True).data)

        serializer = AssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        scope_unit = serializer.validated_data["scope_unit"]
        if not cerbos.check(principal, "role_assignment", scope_unit.code, {"orgPath": scope_unit.path}, "create"):
            raise PermissionDenied()
        serializer.save(user=user)  # post_save → recompute_scope_paths automatique
        record_audit(
            actor=request.user, action="assignment.create", resource_kind="role_assignment",
            resource_id=serializer.instance.id, org_path=scope_unit.path,
            metadata={"role": serializer.instance.role, "target": user.keycloak_sub},
        )
        return Response(serializer.data, status=201)


class AssignmentViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Suppression d'une affectation — contrôlée contre le périmètre de l'unité ciblée.
    Le recompute de scope_paths est automatique (signal post_delete)."""

    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "role_assignment"
    queryset = RoleAssignment.objects.select_related("scope_unit").all()
    serializer_class = AssignmentSerializer

    def get_cerbos_object(self, obj):
        return str(obj.pk), {"orgPath": obj.scope_unit.path}

    def perform_destroy(self, instance):
        meta = {"role": instance.role, "target": instance.user.keycloak_sub}
        org_path, rid = instance.scope_unit.path, str(instance.pk)
        super().perform_destroy(instance)  # post_delete → recompute_scope_paths
        record_audit(actor=self.request.user, action="assignment.delete",
                     resource_kind="role_assignment", resource_id=rid, org_path=org_path, metadata=meta)
