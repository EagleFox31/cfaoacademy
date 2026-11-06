"""Routage cfao-planning. Préfixe `/api/v1/planning/` (conventions architecture.md §5.1)."""
from django.http import JsonResponse
from django.urls import include, path


def healthz(_request):
    """Sonde de vie non authentifiée (healthcheck conteneur)."""
    return JsonResponse({"status": "ok", "service": "cfao-planning"})


urlpatterns = [
    path("api/v1/planning/healthz", healthz),
    path("api/v1/planning/", include("referential.urls")),
    path("api/v1/planning/", include("planning.urls")),
]
