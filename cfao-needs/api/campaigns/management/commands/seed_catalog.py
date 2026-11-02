"""Chargement du catalogue de campagne depuis le fichier de travail 2027.

Particularité assumée : au lieu d'écrire directement en base, la commande fabrique
un classeur en mémoire et le fait passer par **le vrai importeur**
(`CatalogImporter`). Le seed emprunte donc exactement le chemin d'un import réel —
synonymes d'en-têtes, alias de marques, découpage du public cible, clé
`(famille, marque, code)`, transaction tout-ou-rien.

Conséquence utile : si l'import casse, le seed casse aussi. On ne peut pas avoir
une démonstration qui marche et un import qui ne marche pas.
"""
import json
from io import BytesIO
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from openpyxl import Workbook

from campaigns.imports.catalog import COLUMNS, CatalogImporter
from campaigns.models import Campaign, CatalogLine
from referential.models import CatalogFamily

DEFAULT_SOURCE = Path(__file__).resolve().parents[3] / "referential" / "data" / "catalog_2027.json"


class Command(BaseCommand):
    help = "Charge le catalogue d'une campagne depuis un fichier JSON, via l'importeur réel."

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int, default=2027)
        parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)

    def handle(self, *args, **options):
        campaign = Campaign.objects.filter(year=options["year"]).first()
        if not campaign:
            raise CommandError(
                f"Aucune campagne {options['year']}. Lancez d'abord seed_referential."
            )
        # Le job needs-migrate rejoue cette commande à chaque démarrage : sur une
        # campagne ouverte ou close on ne touche à rien, sans échouer (un code non
        # nul bloquerait le démarrage de l'API).
        if campaign.status != Campaign.Status.DRAFT:
            self.stdout.write(
                f"Campagne {campaign.year} {campaign.get_status_display()} : catalogue laissé tel quel "
                f"(les besoins saisis sont rattachés aux lignes existantes)."
            )
            return

        source = options["source"]
        if not source.exists():
            raise CommandError(f"Fichier introuvable : {source}")
        rows = json.loads(source.read_text(encoding="utf-8"))

        # Créer seulement : une famille qui a déjà des lignes garde son catalogue
        # (importé à la main, corrigé…). Les familles dont le catalogue n'est pas
        # livré ne sont pas importées : elles restent visibles avec leur bandeau
        # (spec §3.4).
        filled = set(
            CatalogLine.objects.filter(campaign=campaign).values_list("family__key", flat=True)
        )
        ready = set(
            CatalogFamily.objects.filter(status=CatalogFamily.Status.READY).values_list("key", flat=True)
        )
        kept = [r for r in rows if r["family"] in ready - filled]
        deferred = len([r for r in rows if r["family"] not in ready])
        if not kept:
            self.stdout.write(f"Catalogue {campaign.year} : rien à ajouter.")
            return

        importer = CatalogImporter(campaign, replace=False)
        result = importer.parse(self._workbook(kept))

        if result.fatal:
            raise CommandError(result.fatal)

        if not result.ok:
            self.stdout.write(self.style.ERROR(
                f"Import refusé : {len(result.errors)} ligne(s) en erreur sur {result.rows_read}."
            ))
            for err in result.errors[:10]:
                self.stdout.write(f"  ligne {err.row} · {err.column} · {err.message}")
            if len(result.errors) > 10:
                self.stdout.write(f"  … et {len(result.errors) - 10} autre(s).")
            raise CommandError("Aucune écriture effectuée (transaction tout-ou-rien).")

        log = importer.apply(result, actor="seed_catalog")

        self.stdout.write(self.style.SUCCESS(
            f"Catalogue {campaign.year} chargé : {log.rows_written} lignes."
        ))
        if result.normalizations:
            self.stdout.write("Normalisations appliquées et tracées :")
            for norm in result.normalizations[:10]:
                cible = norm.to_value if norm.to_value is not None else "toutes marques"
                # Fleche ASCII : la console Windows (cp1252) ne sait pas encoder U+2192
                # et une commande qui plante a l'affichage est une commande qui plante.
                self.stdout.write(f"  ligne {norm.row} · {norm.from_value} -> {cible} ({norm.rule})")
        if deferred:
            self.stdout.write(self.style.WARNING(
                f"{deferred} ligne(s) mise(s) de côté : famille au statut « catalogue en préparation »."
            ))

    @staticmethod
    def _workbook(rows: list[dict]) -> BytesIO:
        """Reconstitue un classeur aux en-têtes canoniques du parseur."""
        workbook = Workbook()
        sheet = workbook.active
        sheet.append([c.canonical for c in COLUMNS.columns])
        for row in rows:
            sheet.append([row.get(c.key, "") for c in COLUMNS.columns])
        buffer = BytesIO()
        workbook.save(buffer)
        buffer.seek(0)
        return buffer
