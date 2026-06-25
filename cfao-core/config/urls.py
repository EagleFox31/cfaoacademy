from django.http import JsonResponse
from django.urls import include, path


def healthz(_request):
    """Sonde de vie non authentifiée (healthcheck conteneur)."""
    return JsonResponse({"status": "ok", "service": "cfao-core"})


urlpatterns = [
    path("api/v1/core/healthz", healthz),
    path("api/v1/core/", include("identity.urls")),
    path("api/v1/core/", include("audit.urls")),
    # <generated-routes>  (ne pas retirer : ancre du générateur scripts/new_module.py)
]
