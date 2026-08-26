from rest_framework.routers import SimpleRouter

from .views import BrandViewSet, CatalogFamilyViewSet, OrgUnitViewSet

router = SimpleRouter()
router.register(r"families", CatalogFamilyViewSet, basename="catalog-family")
router.register(r"brands", BrandViewSet, basename="brand")
router.register(r"org-units", OrgUnitViewSet, basename="org-unit")

urlpatterns = router.urls
