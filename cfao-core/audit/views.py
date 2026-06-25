"""Lecture du journal d'audit — **read-only**, scopée par périmètre (query plan)."""
from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from core.authz import cerbos
from core.authz.filters import DeniedAll, plan_to_q
from core.authz.permissions import CerbosPermission
from .models import AuditEvent
from .serializers import AuditEventSerializer


class AuditViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "audit_log"
    queryset = AuditEvent.objects.all()
    serializer_class = AuditEventSerializer

    def get_cerbos_object(self, obj):
        return str(obj.pk), {"orgPath": obj.org_path}

    def get_queryset(self):
        qs = super().get_queryset()
        if getattr(self, "action", None) != "list":
            return qs
        plan = cerbos.plan(self.request.user.to_cerbos(), self.cerbos_resource_kind, "list")
        try:
            return qs.filter(plan_to_q(plan, {"orgPath": "org_path"}))
        except DeniedAll:
            return qs.none()
