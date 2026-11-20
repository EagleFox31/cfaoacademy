"""Référentiel des modules : ajoute ce qui manque, ne modifie jamais l'existant.

Lancé par le job supervision-migrate après `migrate` (AGENTS.md §7) ; sur une base
à jour, aucune écriture. `--demo` ajoute les projets du poste de développement.
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from supervision.models import Module

INVENTORY = Path(__file__).resolve().parents[2] / "inventory" / "modules.json"
FIELDS = ("display_name", "sort_order", "oidc_clients", "edge_modules", "public_prefix")


class Command(BaseCommand):
    help = "Ajoute les modules absents du référentiel (idempotent, sans écrasement)."

    def add_arguments(self, parser):
        parser.add_argument("--demo", action="store_true", help="ajoute aussi les projets de développement")

    def handle(self, *args, demo=False, **options):
        inventory = json.loads(INVENTORY.read_text(encoding="utf-8"))
        rows = inventory["modules"] + (inventory.get("demo", []) if demo else [])
        existing = set(Module.objects.values_list("project", flat=True))
        missing = [row for row in rows if row["project"] not in existing]
        with transaction.atomic():
            for row in missing:
                Module.objects.create(project=row["project"], **{key: row[key] for key in FIELDS if key in row})
        self.stdout.write(f"bootstrap : {len(missing)} module(s) ajouté(s), {len(rows) - len(missing)} déjà présent(s)")
