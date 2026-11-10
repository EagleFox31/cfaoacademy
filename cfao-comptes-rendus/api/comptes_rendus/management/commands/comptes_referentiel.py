"""Cree les comptes d'administration du referentiel (mode local).

    python manage.py comptes_referentiel

Deux comptes (profil `admin_referentiel`, seul autorise a importer le fichier
des participants) : admin.dev1 et admin.dev2. Chacun est ajoute a
`PROFILS_LOCAUX` s'il n'y est pas, avec son mot de passe initial s'il n'en a
pas encore : un mot de passe change ensuite n'est jamais ecrase.
Mots de passe : CR_COMPTE_ADMIN_DEV1_MDP et CR_COMPTE_ADMIN_DEV2_MDP, sans
valeur par defaut : si l'un manque, son compte n'est pas cree (refus par defaut).
"""
import json
import os
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from core.auth import comptes
from core.auth.identity import _profils_locaux, profil_local

COMPTES = {
    "admin.dev1": ("CR_COMPTE_ADMIN_DEV1_MDP", "DEV1"),
    "admin.dev2": ("CR_COMPTE_ADMIN_DEV2_MDP", "DEV2"),
}


class Command(BaseCommand):
    help = "Cree les comptes admin.dev1 et admin.dev2 du referentiel s'ils manquent (mode local)."

    def handle(self, **options):
        if settings.DEPLOYMENT_MODE != "local":
            self.stdout.write("comptes referentiel : inutiles hors du mode local")
            return
        for identifiant, (variable, nom) in COMPTES.items():
            mot_de_passe = os.environ.get(variable, "")
            if not mot_de_passe:
                self.stdout.write(f"comptes referentiel : {variable} absent, {identifiant} non cree")
                continue
            if not profil_local(identifiant):
                profil = {"identifiant": identifiant, "id": identifiant, "roles": ["admin_referentiel"],
                          "firstName": "Admin", "lastName": nom, "scopeNodes": [], "brands": []}
                Path(settings.PROFILS_LOCAUX).write_text(
                    json.dumps(_profils_locaux() + [profil], ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
                self.stdout.write(f"comptes referentiel : profil {identifiant} ajoute")
            if comptes.existe(identifiant):
                self.stdout.write(f"comptes referentiel : {identifiant} a deja un mot de passe")
                continue
            comptes.changer_mot_de_passe(identifiant, mot_de_passe)
            self.stdout.write(f"comptes referentiel : mot de passe initial de {identifiant} cree")
