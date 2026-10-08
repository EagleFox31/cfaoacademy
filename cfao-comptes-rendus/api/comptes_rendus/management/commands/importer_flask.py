"""Reprise des donnees de l'ancien service Flask (`services/apercu/donnees`).

Lit, sans jamais l'ecrire, `comptes-rendus.sqlite` (brouillons et
suppressions) et le dossier `photos/` de l'ancien service, et les verse
dans la base du service. Les comptes et mots de passe ne sont pas repris :
l'identite vient de Keycloak.

Les identifiants des formateurs changent avec Keycloak (`sub`) : la table
`--correspondance` (JSON `{"ancien": "nouveau"}`) les traduit. Un
formateur absent de la table est ignore et signale. `--garder-ids` garde
les identifiants tels quels (mode autonome, profils locaux).

`--essai` montre ce qui serait repris sans rien ecrire.
"""
import json
import re
import shutil
import sqlite3
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

import photos
from comptes_rendus import stockage
from comptes_rendus.models import Brouillon, Photo, Suppression
from comptes_rendus.perimetre import perimetre_du_contenu

REF = re.compile(r"^[0-9a-f]{1,32}$")


class Essai(Exception):
    """Annule la transaction d'un essai."""


def refs_photos(contenu):
    """Les identifiants de photos cites par un brouillon, ou qu'ils soient."""
    trouves = set()
    pile = [contenu]
    while pile:
        x = pile.pop()
        if isinstance(x, dict):
            ref = x.get("ref")
            if isinstance(ref, str) and REF.match(ref):
                trouves.add(ref)
            pile.extend(x.values())
        elif isinstance(x, list):
            pile.extend(x)
    return trouves


class Command(BaseCommand):
    help = "Reprend les brouillons, suppressions et photos de l'ancien service Flask."

    def add_arguments(self, parser):
        parser.add_argument("--source", required=True, help="Dossier `donnees` de l'ancien service.")
        parser.add_argument("--correspondance", help="JSON {ancien identifiant: nouveau}.")
        parser.add_argument("--garder-ids", action="store_true", help="Garder les identifiants tels quels.")
        parser.add_argument("--essai", action="store_true", help="Ne rien ecrire, seulement compter.")

    def handle(self, *args, source, correspondance, garder_ids, essai, **_):
        if bool(correspondance) == garder_ids:
            raise CommandError("Choisir --correspondance FICHIER ou --garder-ids.")
        source = Path(source)
        base = source / "comptes-rendus.sqlite"
        if not base.is_file():
            raise CommandError(f"Base introuvable : {base}")
        table = None
        if correspondance:
            try:
                table = json.loads(Path(correspondance).read_text(encoding="utf-8"))
            except (OSError, ValueError) as exc:
                raise CommandError(f"Correspondance illisible : {exc}")
        traduire = (lambda u: u) if garder_ids else table.get

        # Lecture seule : l'ancienne base n'est jamais modifiee.
        cx = sqlite3.connect(f"{base.resolve().as_uri()}?mode=ro", uri=True)
        try:
            brouillons = cx.execute("SELECT utilisateur, id, contenu, modifie_le FROM brouillons").fetchall()
            supprimes = cx.execute("SELECT utilisateur, id, le FROM supprimes").fetchall()
        finally:
            cx.close()

        bilan = {"brouillons": 0, "brouillons_plus_anciens": 0, "suppressions": 0,
                 "photos": 0, "photos_absentes": 0}
        inconnus = set()
        a_copier = {}
        try:
            with transaction.atomic():
                for utilisateur, ident, le in supprimes:
                    owner = traduire(utilisateur)
                    if not owner:
                        inconnus.add(utilisateur)
                        continue
                    actuel = Brouillon.objects.filter(owner=owner, ident=ident).first()
                    if actuel and actuel.modifie_le > le:
                        continue
                    Brouillon.objects.filter(owner=owner, ident=ident).delete()
                    trace, cree = Suppression.objects.get_or_create(owner=owner, ident=ident, defaults={"le": le})
                    if not cree and trace.le < le:
                        trace.le = le
                        trace.save(update_fields=["le"])
                    bilan["suppressions"] += 1

                for utilisateur, ident, texte, modifie_le in brouillons:
                    owner = traduire(utilisateur)
                    if not owner:
                        inconnus.add(utilisateur)
                        continue
                    contenu = json.loads(texte)
                    if not isinstance(contenu, dict) or not stockage.valide(ident):
                        continue
                    contenu.setdefault("modifieLe", modifie_le)
                    # Pas de revision dans l'ancienne base : seule la date
                    # departage, et une version deja reprise plus recente reste.
                    actuel = Brouillon.objects.filter(owner=owner, ident=ident).first()
                    if actuel and actuel.modifie_le > str(contenu["modifieLe"]):
                        garde = False
                    else:
                        contenu["revision"] = stockage.revision_de(actuel.contenu) if actuel else 0
                        _, garde = stockage.ecrire(owner, ident, contenu)
                    if not garde:
                        bilan["brouillons_plus_anciens"] += 1
                        continue
                    bilan["brouillons"] += 1
                    scope_node, brand = perimetre_du_contenu(contenu)
                    for ref in refs_photos(contenu):
                        fichier = source / "photos" / f"{ref}.jpg"
                        # Une photo restee vide (ecriture interrompue) n'est pas reprise.
                        if not fichier.is_file() or fichier.stat().st_size == 0:
                            bilan["photos_absentes"] += 1
                            continue
                        _, cree = Photo.objects.get_or_create(
                            owner=owner, ident=ref, defaults={"scope_node": scope_node, "brand": brand})
                        bilan["photos"] += int(cree)
                        a_copier[ref] = fichier
                if essai:
                    raise Essai
        except Essai:
            pass

        if not essai:
            photos.PERMANENT.mkdir(parents=True, exist_ok=True)
            for ref, fichier in a_copier.items():
                cible = photos.PERMANENT / f"{ref}.jpg"
                if not cible.is_file() or cible.stat().st_size == 0:
                    temporaire = cible.with_suffix(".tmp")
                    shutil.copyfile(fichier, temporaire)
                    temporaire.replace(cible)

        prefixe = "[essai] " if essai else ""
        self.stdout.write(prefixe + ", ".join(f"{k} : {v}" for k, v in bilan.items()))
        if inconnus:
            self.stdout.write(self.style.WARNING(
                f"{prefixe}{len(inconnus)} formateur(s) absent(s) de la correspondance, ignore(s) : "
                + ", ".join(sorted(inconnus))))
