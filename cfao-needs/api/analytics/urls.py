from django.urls import path

from .views import allocations_per_branch, scheduled_trainings, total_technicians

urlpatterns = [
    path("analytics/scheduled-trainings",  scheduled_trainings,  name="analytics-scheduled-trainings"),
    path("analytics/allocations-per-branch", allocations_per_branch, name="analytics-allocations-per-branch"),
    path("analytics/total-technicians", total_technicians, name="analytics-total-technicians"),
]
