"""Importe le fichier Excel des participants dans le referentiel des formations.

    python manage.py importer_referentiel <chemin>             essai : rien n'est ecrit
    python manage.py importer_referentiel <chemin> --appliquer ecrit en base

Imprime le rapport. Rien n'est jamais supprime.
"""
from django.core.management.base import BaseCommand, CommandError

from comptes_rendus import import_referentiel

LIBELLES = (
    ("lignes_lues", "lignes lues"),
    ("sessions_a_creer", "sessions a creer"),
    ("sessions_a_mettre_a_jour", "sessions a mettre a jour"),
    ("sessions_inchangees", "sessions inchangees"),
    ("formations_a_creer", "formations a creer"),
    ("stagiaires_a_creer", "stagiaires a creer"),
    ("inscriptions_a_creer", "inscriptions a creer"),
)


class Command(BaseCommand):
    help = "Importe le fichier Excel des participants (essai par defaut)."

    def add_arguments(self, parser):
        parser.add_argument("chemin", help="fichier .xlsx des participants")
        parser.add_argument("--appliquer", action="store_true", help="ecrit en base (sinon essai)")

    def handle(self, chemin, appliquer=False, **options):
        try:
            with open(chemin, "rb") as f:
                lignes = import_referentiel.lire(f)
        except OSError as e:
            raise CommandError(f"fichier illisible : {e.strerror or e}") from e
        except import_referentiel.FichierInvalide as e:
            raise CommandError(str(e)) from e
        nom = str(chemin).replace("\\", "/").rsplit("/", 1)[-1]
        if appliquer:
            rapport = import_referentiel.appliquer(lignes, auteur="commande", nom_fichier=nom)
        else:
            rapport = import_referentiel.analyser(lignes, nom_fichier=nom)
        out = self.stdout.write
        out(("IMPORT APPLIQUE" if appliquer else "ESSAI (rien n'est ecrit)") + f" : {nom}")
        for cle, libelle in LIBELLES:
            out(f"  {libelle} : {rapport[cle]}")
        out(f"  animateurs rattaches : {', '.join(rapport['animateurs_rattaches']) or 'aucun'}")
        out(f"  animateurs non rattaches : {', '.join(rapport['animateurs_non_rattaches']) or 'aucun'}")
        out(f"  anomalies : {len(rapport['anomalies'])}")
        for a in rapport["anomalies"]:
            out(f"    - [{a['type']}] {a['session'] + ' : ' if a['session'] else ''}{a['message']}")
