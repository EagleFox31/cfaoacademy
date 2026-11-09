"""Creation de base (AGENTS.md section 7), lancee par le job service-migrate.

    python manage.py bootstrap [--demo]

migrate, puis les commandes de referentiel de settings.BOOTSTRAP_SEEDS, en
creer-seulement (core.seeding.ensure) : sur une base a jour, zero ecriture.
--demo ajoute settings.BOOTSTRAP_DEMO_SEEDS, jamais en production.
"""
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Schema + referentiel manquant ; rejouable sans ecriture."

    def add_arguments(self, parser):
        parser.add_argument("--demo", action="store_true", help="donnees de demonstration (dev)")

    def handle(self, *args, demo=False, **options):
        call_command("migrate", interactive=False, verbosity=options["verbosity"])
        seeds = list(getattr(settings, "BOOTSTRAP_SEEDS", []))
        if demo:
            seeds += getattr(settings, "BOOTSTRAP_DEMO_SEEDS", [])
        for seed in seeds:
            call_command(seed, verbosity=options["verbosity"])
