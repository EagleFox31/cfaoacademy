from django.urls import path

from . import views

urlpatterns = [
    path("access", views.AccessView.as_view()),
    path("overview", views.OverviewView.as_view()),
    path("dependencies", views.DependenciesView.as_view()),
    path("connections", views.ConnectionsView.as_view()),
    path("modules/<str:project>", views.ModuleDetailView.as_view()),
    path("modules/<str:project>/history", views.ModuleHistoryView.as_view()),
]
