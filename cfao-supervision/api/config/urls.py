"""Routage cfao-supervision. Préfixe `/api/v1/supervision/` (architecture.md §5.1)."""
from django.http import JsonResponse
from django.urls import include, path


def healthz(_request):
    """Sonde de vie non authentifiée (healthcheck conteneur)."""
    return JsonResponse({"status": "ok", "service": "cfao-supervision"})


urlpatterns = [
    path("api/v1/supervision/healthz", healthz),
    path("api/v1/supervision/", include("supervision.urls")),
]
