"""Renseigne les libellés de niveau constructeur sur les lignes déjà en base.

Complète `level_label` sans toucher aux besoins saisis — même raison que
`backfill_titles_en` : rejouer `seed_catalog` sur une campagne ouverte casserait
les liens `NeedLine → CatalogLine`.
"""
from django.core.management.base import BaseCommand

from campaigns.imports.levels import level_label
from campaigns.models import CatalogLine


class Command(BaseCommand):
    help = "Applique les niveaux constructeur (G4, Bronze…) aux lignes de catalogue."

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int, help="Limiter à une campagne.")
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Écraser les libellés déjà présents.",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        lines = CatalogLine.objects.select_related("campaign", "brand").all()
        if options["year"]:
            lines = lines.filter(campaign__year=options["year"])

        updated = []
        for line in lines:
            label = level_label(line.code, tier=line.tier, brand=line.brand.code if line.brand_id else "")
            if not label:
                continue
            if line.level_label and not options["overwrite"]:
                continue
            if line.level_label == label:
                continue
            line.level_label = label
            updated.append(line)

        if not options["dry_run"] and updated:
            CatalogLine.objects.bulk_update(updated, ["level_label"], batch_size=200)

        total = lines.count()
        prefix = "À écrire" if options["dry_run"] else "Écrit"
        self.stdout.write(self.style.SUCCESS(f"{prefix} : {len(updated)} ligne(s) sur {total}."))
