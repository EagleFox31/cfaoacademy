from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    CampaignViewSet,
    SubmissionViewSet,
    campaign_catalog,
    campaign_summary,
    catalog_import,
    catalog_template,
)

router = SimpleRouter()
router.register(r"campaigns", CampaignViewSet, basename="campaign")
router.register(r"submissions", SubmissionViewSet, basename="submission")

urlpatterns = [
    *router.urls,
    path("campaigns/<uuid:pk>/catalog", campaign_catalog, name="campaign-catalog"),
    path("campaigns/<uuid:pk>/summary", campaign_summary, name="campaign-summary"),
    path("imports/catalog/template", catalog_template, name="catalog-template"),
    path("imports/catalog", catalog_import, name="catalog-import"),
]
