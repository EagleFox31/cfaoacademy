"""Les tables du referentiel dans l'administration Django.

Inactif tant que `django.contrib.admin` n'est pas dans INSTALLED_APPS :
le service n'expose pas d'administration pour l'instant, ce fichier
prepare l'enregistrement des tables.
"""
from django.contrib import admin

from .models import Animation, Formation, ImportReferentiel, Inscription, Session, Stagiaire


@admin.register(Formation)
class FormationAdmin(admin.ModelAdmin):
    list_display = ("code", "libelle", "marque", "type", "seuil")
    search_fields = ("code", "libelle")


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ("numero", "formation", "debut", "fin", "lieu", "pays")
    list_filter = ("pays",)
    search_fields = ("numero", "libelle_fichier")


@admin.register(Stagiaire)
class StagiaireAdmin(admin.ModelAdmin):
    list_display = ("nom", "prenom", "pays")
    search_fields = ("cle",)


@admin.register(Inscription)
class InscriptionAdmin(admin.ModelAdmin):
    list_display = ("session", "stagiaire", "absent")


@admin.register(Animation)
class AnimationAdmin(admin.ModelAdmin):
    list_display = ("session", "nom_fichier", "formateur_id")


@admin.register(ImportReferentiel)
class ImportReferentielAdmin(admin.ModelAdmin):
    list_display = ("le", "auteur", "nom_fichier", "etat")
