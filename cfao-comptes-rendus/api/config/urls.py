from django.urls import include, path

urlpatterns = [
    path("", include("comptes_rendus.urls")),
]
