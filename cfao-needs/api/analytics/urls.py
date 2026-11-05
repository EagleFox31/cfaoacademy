import json

from django.http import JsonResponse
from django.urls import path

from .contract import CONTRACT_PATH
from .views import allocations_per_branch, scheduled_trainings, total_technicians


def analytics_contract(_request):
    """Contrat publié, sans clé : il ne décrit que la forme des réponses."""
    return JsonResponse(json.loads(CONTRACT_PATH.read_text(encoding="utf-8")))


urlpatterns = [
    path("analytics/contract", analytics_contract, name="analytics-contract"),
    path("analytics/scheduled-trainings",  scheduled_trainings,  name="analytics-scheduled-trainings"),
    path("analytics/allocations-per-branch", allocations_per_branch, name="analytics-allocations-per-branch"),
    path("analytics/total-technicians", total_technicians, name="analytics-total-technicians"),
]
