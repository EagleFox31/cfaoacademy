from django.urls import path

from .views import GroupStatsView

urlpatterns = [
    path("analytics/group-stats", GroupStatsView.as_view(), name="analytics-group-stats"),
]
