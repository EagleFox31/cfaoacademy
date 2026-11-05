from django.urls import path
from rest_framework.routers import SimpleRouter

from core.routers import OptionalSlashRouter
from .views import (
    CampaignViewSet,
    SubmissionViewSet,
    campaign_brands,
    campaign_catalog,
    campaign_my_submission,
    campaign_summary,
    catalog_import,
    catalog_template,
)

router = OptionalSlashRouter()
router.register(r"campaigns", CampaignViewSet, basename="campaign")
router.register(r"submissions", SubmissionViewSet, basename="submission")

urlpatterns = [
    *router.urls,
    path("campaigns/<uuid:pk>/brands", campaign_brands, name="campaign-brands"),
    path("campaigns/<uuid:pk>/catalog", campaign_catalog, name="campaign-catalog"),
    path("campaigns/<uuid:pk>/submission", campaign_my_submission, name="campaign-my-submission"),
    path("campaigns/<uuid:pk>/summary", campaign_summary, name="campaign-summary"),
    path("imports/catalog/template", catalog_template, name="catalog-template"),
    path("imports/catalog", catalog_import, name="catalog-import"),
]
