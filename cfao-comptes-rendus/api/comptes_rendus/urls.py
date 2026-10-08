"""Routes explicites, sans barre finale : celles que le portail appelle deja."""
from django.urls import path, re_path

from . import views

urlpatterns = [
    path("apercu/sante", views.Sante.as_view()),
    path("apercu/page", views.Page.as_view()),
    path("apercu/photo", views.PhotoEnvoi.as_view()),
    path("apercu/document", views.Document.as_view()),
    path("apercu/rapport", views.RapportComplet.as_view()),
    path("apercu/rapports", views.RapportLancer.as_view()),
    path("apercu/rapports/<str:ident>", views.RapportEtat.as_view()),
    path("apercu/rapports/<str:ident>/fichier", views.RapportFichier.as_view()),
    path("apercu/redaction", views.Redaction.as_view()),
    path("cr-donnees/connexion", views.Connexion.as_view()),
    path("cr-donnees/session", views.Session.as_view()),
    path("cr-donnees/deconnexion", views.Deconnexion.as_view()),
    path("cr-donnees/brouillons", views.BrouillonsListe.as_view()),
    path("cr-donnees/brouillons/<str:ident>", views.BrouillonDetail.as_view()),
    re_path(r"^cr-donnees/photos/(?P<ident>[0-9a-f]{1,32})\.jpg$", views.PhotoServie.as_view()),
]
