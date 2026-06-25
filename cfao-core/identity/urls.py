from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import AssignmentViewSet, MeView, OrgUnitViewSet, UserViewSet

router = SimpleRouter()
router.register(r"org/units", OrgUnitViewSet, basename="org-unit")
router.register(r"users", UserViewSet, basename="user")
router.register(r"assignments", AssignmentViewSet, basename="assignment")

urlpatterns = [
    path("me", MeView.as_view(), name="me"),
    *router.urls,
]
