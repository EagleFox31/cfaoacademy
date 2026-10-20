"""Renseigne les titres anglais des lignes de catalogue déjà en base.

Pourquoi une commande plutôt qu'un nouvel import : une ligne de catalogue est
immuable une fois la campagne ouverte, et les besoins déjà saisis y sont
rattachés (`NeedLine.catalog_line` est PROTECT). Rejouer `seed_catalog` les
supprimerait — ou échouerait. Ici on ne touche qu'une colonne d'affichage, sans
déplacer une seule ligne.

Idempotent : relancer après avoir complété `titles_en.json` ne réécrit que ce qui
a changé.
"""
from django.core.management.base import BaseCommand

from campaigns.imports.titles_en import english_title
from campaigns.models import CatalogLine


class Command(BaseCommand):
    help = "Applique les titres anglais du catalogue aux lignes existantes."

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int, help="Limiter à une campagne.")
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Écraser les titres anglais déjà présents (par défaut on ne comble que les vides).",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        lines = CatalogLine.objects.all()
        if options["year"]:
            lines = lines.filter(campaign__year=options["year"])

        updated = []
        missing = []
        for line in lines:
            translated = english_title(line.title)
            if not translated:
                missing.append(line.code)
                continue
            if line.title_en and not options["overwrite"]:
                continue
            if line.title_en == translated:
                continue
            line.title_en = translated
            updated.append(line)

        if not options["dry_run"] and updated:
            CatalogLine.objects.bulk_update(updated, ["title_en"], batch_size=200)

        total = lines.count()
        prefix = "À écrire" if options["dry_run"] else "Écrit"
        self.stdout.write(self.style.SUCCESS(f"{prefix} : {len(updated)} ligne(s) sur {total}."))
        if missing:
            uniques = sorted(set(missing))
            self.stdout.write(self.style.WARNING(
                f"{len(missing)} ligne(s) sans traduction, affichées en français "
                f"({len(uniques)} code(s) distincts) : {', '.join(uniques[:15])}"
                + (" …" if len(uniques) > 15 else "")
            ))
