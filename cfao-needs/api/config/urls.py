"""Routage cfao-needs. Préfixe `/api/v1/needs/` (conventions architecture.md §5.1)."""
from django.http import JsonResponse
from django.urls import include, path


def healthz(_request):
    """Sonde de vie non authentifiée (healthcheck conteneur)."""
    return JsonResponse({"status": "ok", "service": "cfao-needs"})


urlpatterns = [
    path("api/v1/needs/healthz", healthz),
    path("api/v1/needs/", include("referential.urls")),
    path("api/v1/needs/", include("campaigns.urls")),
    path("api/v1/needs/", include("outbound.urls")),
]
