from django.urls import path

from .views import ManagerScopeView

urlpatterns = [
    path("manager/scope", ManagerScopeView.as_view(), name="manager-scope"),
]
