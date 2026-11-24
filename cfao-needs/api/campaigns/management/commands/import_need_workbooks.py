"""Importe les fiches d'identification des besoins d'une campagne.

Usage : manage.py import_need_workbooks <dossier> --year 2027 [--dry-run]
        [--validated-by <Suivi 2027.xlsx>]

Rejouable : une seconde exécution n'écrit rien. Les classeurs restent hors du
dépôt, ils portent les besoins réels des filiales.
"""
import hashlib
import json
from collections import Counter
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from campaigns.imports.need_workbooks import (
    _workbooks, apply_rows, parse_directory, pending_files, unknown_files, validated_pairs,
)
from campaigns.models import Campaign

JSON_BUDGET = 3000  # octets : la ligne d'événement complète reste sous 4 Ko


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def json_summary(directory: Path, rows, report, pending: list[str]) -> str:
    """{fichiers, compteurs} sur une ligne. Fichiers écartés d'abord (ce qu'il faut
    regarder), puis les fiches lues ; au-delà du budget, le reste est compté."""
    lines = Counter(r.source for r in rows)
    unknown, waiting = set(unknown_files(directory)), set(pending)
    order = {"ignore": 0, "en_attente": 1, "importe": 2}
    files = []
    for path in _workbooks(directory):
        status = ("ignore" if path.name in unknown else
                  "en_attente" if path.name in waiting else "importe")
        files.append({"nom": path.name, "sha256": _sha256(path), "type": "fiche_besoins",
                      "status": status, "lignes": lines.get(path.name, 0)})
    files.sort(key=lambda f: order[f["status"]])
    kept: list[dict] = []
    for item in files:
        if len(json.dumps(kept + [item], ensure_ascii=False).encode()) > JSON_BUDGET:
            break
        kept.append(item)
    counters = {
        "places_ajoutees": report.total_places_added,
        "fiches_creees": len(report.submissions_created),
        "en_attente": len(waiting),
    }
    if len(kept) < len(files):
        counters["fichiers_omis"] = len(files) - len(kept)
    return json.dumps({"fichiers": kept, "compteurs": counters},
                      ensure_ascii=False, separators=(",", ":"))


class Command(BaseCommand):
    help = "Importe les fiches de besoins des filiales, sans écraser l'existant."

    def add_arguments(self, parser):
        parser.add_argument("directory", type=Path)
        parser.add_argument("--year", type=int, required=True)
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--validated-by", type=Path, default=None,
            help="Classeur de suivi : seules les fiches validées (feuille RDV) sont importées.",
        )
        parser.add_argument(
            "--json", action="store_true",
            help="Termine par une ligne « JSON {fichiers, compteurs} » (événements d'import).",
        )

    def handle(self, directory, year, dry_run, validated_by=None, **options):
        campaign = Campaign.objects.filter(year=year).first()
        if campaign is None:
            raise CommandError(f"Aucune campagne {year}.")
        pairs = None
        if validated_by is not None:
            try:
                pairs = validated_pairs(validated_by)
            except ValueError as exc:
                raise CommandError(str(exc)) from exc
        rows = parse_directory(directory, pairs)
        if not rows:
            raise CommandError(f"Aucune ligne demandée dans {directory}.")
        with transaction.atomic():
            report = apply_rows(campaign, rows)
            if dry_run:
                transaction.set_rollback(True)
        write = self.stdout.write
        pending = pending_files(directory, pairs) if pairs is not None else []
        for name in unknown_files(directory):
            write(f"IGNORE {name} : filiale non reconnue au nom du fichier")
        for name in pending:
            write(f"EN ATTENTE {name} : fiche non validée dans le suivi (RDV, rapport, calendrier)")
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
        if options.get("json"):
            write("JSON " + json_summary(directory, rows, report, pending))
