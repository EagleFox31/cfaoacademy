"""LMS — vues. Catalogue **global** (Course/Module) ; inscription **scopée + self** (Enrollment)."""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from core.authz import cerbos
from core.authz.filters import DeniedAll, plan_to_q
from core.authz.permissions import CerbosPermission
from .models import Course, Enrollment, Module
from .serializers import CourseSerializer, EnrollmentSerializer, ModuleSerializer


class CourseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "course"
    queryset = Course.objects.all()
    serializer_class = CourseSerializer


class ModuleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "course"  # contenu catalogue → même gouvernance que Course
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer


class EnrollmentViewSet(viewsets.ModelViewSet):
    """Inscriptions — scopées (équipe) + règle self (l'apprenant gère les siennes)."""

    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "enrollment"
    queryset = Enrollment.objects.select_related("course").all()
    serializer_class = EnrollmentSerializer
    ATTR_MAP = {"orgPath": "org_path", "learnerSub": "learner_sub"}

    def get_cerbos_object(self, obj):
        return str(obj.pk), {"orgPath": obj.org_path, "learnerSub": obj.learner_sub}

    def _learner_scope(self, sub):
        from identity.models import User
        u = User.objects.filter(keycloak_sub=sub).first()
        return u.scope_paths if u else []

    def get_cerbos_target(self, request):
        # Création : par défaut auto-inscription (sub = soi) ; sinon affectation par un manager.
        sub = (getattr(request, "data", {}) or {}).get("learner_sub") or request.user.id
        return sub, {"orgPath": self._learner_scope(sub), "learnerSub": sub}

    def get_queryset(self):
        qs = super().get_queryset()
        if getattr(self, "action", None) != "list":
            return qs
        plan = cerbos.plan(self.request.user.to_cerbos(), self.cerbos_resource_kind, "list")
        try:
            return qs.filter(plan_to_q(plan, self.ATTR_MAP))
        except DeniedAll:
            return qs.none()

    def perform_create(self, serializer):
        sub = serializer.validated_data.get("learner_sub") or self.request.user.id
        serializer.save(learner_sub=sub, org_path=self._learner_scope(sub))
