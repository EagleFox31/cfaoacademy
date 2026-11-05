"""Import du référentiel participants 2025 dans cfao-needs.

Consomme cfao_needs_referential.json (dry-run) :
  - Marques → Brand (update_or_create par code)
  - Filiales → OrgUnitRef (update_or_create par code)
  - Partenaires B2B → OrgUnitRef marqués nature externe

NE contient aucune donnée personnelle (noms, emails).

Usage :
  python manage.py import_participants_referential \\
    --json docs/dryrun_participants_2025/cfao_needs_referential.json
  python manage.py import_participants_referential --json ... --dry-run
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from referential.models import Brand, OrgUnitRef, Pole


def _slug(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")


def _pole(raw: str) -> str:
    up = raw.upper()
    if "EQUIP" in up:
        return Pole.EQUIPMENT
    if "MOTOR" in up or "MOBIL" in up:
        return Pole.MOBILITY
    if "CARROS" in up:
        return Pole.CARROSSERIE
    return Pole.AUTRE


class Command(BaseCommand):
    help = "Importe marques + org du fichier participants 2025 dans le référentiel needs."

    def add_arguments(self, parser):
        parser.add_argument("--json", type=Path, required=True)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        path: Path = opts["json"]
        if not path.exists():
            raise CommandError(f"Fichier introuvable : {path}")

        data = json.loads(path.read_text(encoding="utf-8"))
        dry = opts["dry_run"]
        counts = {"brands": 0, "org_units": 0, "partners": 0}

        if dry:
            self.stdout.write(self.style.WARNING("=== DRY RUN ==="))

        with transaction.atomic():
            for b in data.get("brands", []):
                code = _slug(b["label"])
                pole = _pole(b.get("pole", ""))
                if dry:
                    self.stdout.write(f"  [brand] {code} — {b['label']} ({pole})")
                else:
                    Brand.objects.update_or_create(
                        code=code,
                        defaults={"label": b["label"], "pole": pole, "is_active": True},
                    )
                counts["brands"] += 1

            for u in data.get("org_units", []):
                code = u["code"][:64]
                if dry:
                    self.stdout.write(f"  [org] {code} — {u['label']}")
                else:
                    OrgUnitRef.objects.update_or_create(
                        code=code,
                        defaults={
                            "label": u["label"],
                            "country": "",
                            "is_active": True,
                        },
                    )
                counts["org_units"] += 1

            for p in data.get("org_partners_b2b", []):
                code = p["code"][:64]
                if dry:
                    self.stdout.write(f"  [partner] {code} — {p['label']}")
                else:
                    OrgUnitRef.objects.update_or_create(
                        code=code,
                        defaults={"label": p["label"], "is_active": True},
                    )
                counts["partners"] += 1

            if dry:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            f"\n{'[DRY RUN] ' if dry else ''}Import needs référentiel terminé :\n"
            f"  Marques:     {counts['brands']}\n"
            f"  Org units:   {counts['org_units']}\n"
            f"  Partenaires: {counts['partners']}"
        ))
