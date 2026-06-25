from rest_framework.routers import SimpleRouter

from .views import AuditViewSet

router = SimpleRouter()
router.register(r"audit", AuditViewSet, basename="audit")

urlpatterns = router.urls
