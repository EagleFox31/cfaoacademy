from rest_framework.routers import SimpleRouter

from .views import PortalSuggestionViewSet

router = SimpleRouter()
router.register(r"portal-suggestions", PortalSuggestionViewSet, basename="portal_suggestion")

urlpatterns = router.urls
