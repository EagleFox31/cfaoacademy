"""Base ViewSet sécurisée que les modules générés réutilisent.

- PEP Cerbos (default-deny) sur chaque action ;
- objet : check_resource avec le périmètre de l'objet ;
- liste : filtrage par **query plan** Cerbos (jamais de filtrage manuel).
"""
from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from . import cerbos, filters
from .permissions import CerbosPermission

# Attribut ressource Cerbos → champ ORM (ScopedModel).
SCOPE_ATTR_MAP = {"orgPath": "org_path", "department": "department", "brand": "brand"}


class ScopedCerbosViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind: str | None = None  # à définir par le module

    # ── niveau objet ──
    def get_cerbos_object(self, obj):
        return str(obj.pk), {
            "orgPath": getattr(obj, "org_path", []),
            "department": getattr(obj, "department", ""),
            "brand": getattr(obj, "brand", ""),
        }

    # ── niveau collection (create) : périmètre tiré du payload ──
    def get_cerbos_target(self, request):
        data = getattr(request, "data", {}) or {}
        return str(data.get("id", "*")), {
            "orgPath": data.get("org_path", []),
            "department": data.get("department", ""),
            "brand": data.get("brand", ""),
        }

    # ── liste : query plan → filtre queryset (fail-closed) ──
    def get_queryset(self):
        qs = super().get_queryset()
        if getattr(self, "action", None) != "list":
            return qs
        plan = cerbos.plan(self.request.user.to_cerbos(), self.cerbos_resource_kind, "list")
        try:
            condition = filters.plan_to_q(plan, SCOPE_ATTR_MAP)
        except filters.DeniedAll:
            return qs.none()
        return qs.filter(condition)
