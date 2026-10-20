from rest_framework.routers import DefaultRouter
from .views import SampleItemViewSet

router = DefaultRouter()
router.register(r"items", SampleItemViewSet, basename="sample-item")

urlpatterns = router.urls
