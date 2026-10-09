"""Retour vers l'ancien service Flask : l'inverse d'`importer_flask`.

Ecrit, dans un dossier neuf (`--cible`), une base `comptes-rendus.sqlite`
au format de l'ancien service (brouillons et suppressions) et le dossier
`photos/` des photos citees. Les identifiants des formateurs sont gardes
tels quels (mode local, profils locaux).

Ne modifie jamais la base du service. Sert au retour arriere : le dossier
produit remplace `comptes-rendus.sqlite` et complete `photos/` dans les
donnees de l'ancien service.
"""
import json
import shutil
import sqlite3
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

import photos
from comptes_rendus.models import Brouillon, Suppression

from .importer_flask import refs_photos


class Command(BaseCommand):
    help = "Exporte brouillons, suppressions et photos au format de l'ancien service Flask."

    def add_arguments(self, parser):
        parser.add_argument("--cible", required=True, help="Dossier neuf (absent ou vide).")

    def handle(self, *args, cible, **_):
        cible = Path(cible)
        if cible.exists() and any(cible.iterdir()):
            raise CommandError(f"Le dossier cible n'est pas vide : {cible}")
        (cible / "photos").mkdir(parents=True, exist_ok=True)

        bilan = {"brouillons": 0, "suppressions": 0, "photos": 0, "photos_absentes": 0}
        refs = set()
        cx = sqlite3.connect(cible / "comptes-rendus.sqlite")
        try:
            with cx:
                cx.execute("CREATE TABLE brouillons (utilisateur TEXT NOT NULL, id TEXT NOT NULL,"
                           " contenu TEXT NOT NULL, modifie_le TEXT NOT NULL, PRIMARY KEY (utilisateur, id))")
                cx.execute("CREATE TABLE supprimes (utilisateur TEXT NOT NULL, id TEXT NOT NULL,"
                           " le TEXT NOT NULL, PRIMARY KEY (utilisateur, id))")
                for b in Brouillon.objects.order_by("owner", "ident"):
                    cx.execute("INSERT INTO brouillons VALUES (?, ?, ?, ?)",
                               (b.owner, b.ident, json.dumps(b.contenu, ensure_ascii=False), b.modifie_le))
                    refs |= refs_photos(b.contenu)
                    bilan["brouillons"] += 1
                for s in Suppression.objects.order_by("owner", "ident"):
                    cx.execute("INSERT INTO supprimes VALUES (?, ?, ?)", (s.owner, s.ident, s.le))
                    bilan["suppressions"] += 1
        finally:
            cx.close()

        for ref in sorted(refs):
            source = photos.PERMANENT / f"{ref}.jpg"
            if not source.is_file() or source.stat().st_size == 0:
                bilan["photos_absentes"] += 1
                continue
            shutil.copyfile(source, cible / "photos" / f"{ref}.jpg")
            bilan["photos"] += 1

        self.stdout.write(", ".join(f"{k} : {v}" for k, v in bilan.items()))
