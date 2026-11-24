"""Création de base automatique (AGENTS.md §7) : schéma puis référentiel.

Lancée par le job ponctuel `needs-migrate` à chaque `docker compose up`, jamais
par l'entrypoint de l'API (interdit n° 10) : l'API et le worker attendent que le
job sorte en 0 (`service_completed_successfully`), donc aucune migration ne court
en parallèle entre répliques.

- Base vide : migrations, puis familles, marques, alias, racine, campagne en
  brouillon, catalogue et modèles d'emails.
- Base à jour : zéro écriture (chaque seed crée seulement ce qui manque).
- Base existante : seules les migrations et les lignes absentes s'ajoutent ;
  une donnée modifiée en production n'est jamais réécrite.

`--demo` (recette, développement) ajoute agences et comptes de démonstration ;
`--open` ouvre la campagne. Ni l'un ni l'autre en production.
"""
from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Migre puis crée le référentiel manquant ; rejouable, sans jamais écraser."

    def add_arguments(self, parser):
        parser.add_argument("--demo", action="store_true", help="Ajoute les comptes de démonstration.")
        parser.add_argument("--open", action="store_true", help="Ouvre la campagne (recette locale).")

    def handle(self, *args, **options):
        verbosity = options["verbosity"]
        call_command("migrate", interactive=False, verbosity=verbosity)
        call_command("seed_referential", demo=options["demo"], verbosity=verbosity)
        call_command("seed_catalog", verbosity=verbosity)
        call_command("seed_email_templates", verbosity=verbosity)
        # En dernier : le catalogue ne se charge que sur une campagne en brouillon.
        if options["open"]:
            call_command("seed_referential", demo=options["demo"], open=True, verbosity=verbosity)
        self.stdout.write(self.style.SUCCESS("Base prête."))
