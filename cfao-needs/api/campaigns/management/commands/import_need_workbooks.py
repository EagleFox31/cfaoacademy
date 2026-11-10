"""Importe les fiches d'identification des besoins d'une campagne.

Usage : manage.py import_need_workbooks <dossier> --year 2027 [--dry-run]

Rejouable : une seconde exécution n'écrit rien. Les classeurs restent hors du
dépôt, ils portent les besoins réels des filiales.
"""
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from campaigns.imports.need_workbooks import apply_rows, parse_directory
from campaigns.models import Campaign


class Command(BaseCommand):
    help = "Importe les fiches de besoins des filiales, sans écraser l'existant."

    def add_arguments(self, parser):
        parser.add_argument("directory", type=Path)
        parser.add_argument("--year", type=int, required=True)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, directory, year, dry_run, **options):
        campaign = Campaign.objects.filter(year=year).first()
        if campaign is None:
            raise CommandError(f"Aucune campagne {year}.")
        rows = parse_directory(directory)
        if not rows:
            raise CommandError(f"Aucune ligne demandée dans {directory}.")
        with transaction.atomic():
            report = apply_rows(campaign, rows)
            if dry_run:
                transaction.set_rollback(True)
        write = self.stdout.write
        write(f"Places lues : {sum(sum(r.quantities) for r in rows)} ({len(rows)} lignes)")
        write(f"Modules ajoutés au catalogue : {len(report.catalog_added)}")
        write(f"Fiches créées : {report.submissions_created}")
        write(f"Places ajoutées : {report.total_places_added} {dict(report.places_added)}")
        write(f"Besoins déjà en base, identiques : {report.unchanged}")
        write(f"Besoins précisés (lieu, report) : {report.lines_precised}")
        for label, items in (("REPARTI", report.split), ("CONFLIT", report.conflicts), ("AMBIGU", report.ambiguous), ("LIEU", report.place_conflicts)):
            for item in items:
                write(f"{label} {item}")
        if dry_run:
            write("Essai à blanc : rien n'a été écrit.")
