"""Import participants 2025 — écrit dans cfao-core (identity + lms).

Prérequis :
  1. Le dry-run a produit entities.json (scripts/dryrun_participants_2025.py)
  2. Les 94 arbitrages RH sont faits (revue_arbitrages.xlsx → decisions.json)
  3. Les emails / matricules sont collectés (R13)

Ce command ne touche PAS cfao-operations (Node) ni cfao-needs (Django séparé).
Voir import_needs_referential.py pour le volet cfao-needs.
Voir docs/IMPORT_OPERATIONS.md pour le volet sessions/participations (Node).

Usage :
  python manage.py import_participants_2025 --entities docs/dryrun_participants_2025/entities.json
  python manage.py import_participants_2025 --entities ... --decisions docs/.../decisions.json
  python manage.py import_participants_2025 --entities ... --dry-run   # simule sans écrire
"""
from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from identity.models import Brand, OrgUnit, User


class Command(BaseCommand):
    help = "Import participants 2025 → identity (apprenants, clients/org, marques) + lms (formations)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--entities", type=Path, required=True,
            help="Chemin vers entities.json du dry-run",
        )
        parser.add_argument(
            "--decisions", type=Path, default=None,
            help="Chemin vers decisions.json (arbitrages slug/multi-client/sans-prénom)",
        )
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Affiche ce qui serait importé sans écrire en base",
        )

    def handle(self, *args, **opts):
        entities_path: Path = opts["entities"]
        if not entities_path.exists():
            raise CommandError(f"Fichier introuvable : {entities_path}")

        data = json.loads(entities_path.read_text(encoding="utf-8"))
        decisions = {}
        if opts["decisions"] and opts["decisions"].exists():
            decisions = json.loads(opts["decisions"].read_text(encoding="utf-8"))

        dry = opts["dry_run"]
        counts = {"brands": 0, "org_units": 0, "users": 0, "formations": 0, "skipped": 0}

        if dry:
            self.stdout.write(self.style.WARNING("=== DRY RUN — aucune écriture ==="))

        with transaction.atomic():
            # ── 1. Marques ──────────────────────────────────────────────
            for m in data.get("marques", []):
                code = m["code"].lower().replace("_", "-")
                cat = "vl" if m["pole"] == "MOBILITY" else "engins"
                if dry:
                    self.stdout.write(f"  [brand] {code} ({m['label']}) — {cat}")
                else:
                    Brand.objects.update_or_create(
                        code=code,
                        defaults={"name": m["label"], "category": cat},
                    )
                counts["brands"] += 1

            # ── 2. Org units (clients = filiales) ───────────────────────
            # On crée les filiales comme des nœuds de type « branch » sous le groupe racine.
            groupe, _ = OrgUnit.objects.get_or_create(
                slug="groupe", defaults={"kind": "group", "name": "Groupe CFAO"},
            ) if not dry else (None, False)

            for c in data.get("clients", []):
                slug = c["code"][:64]
                if dry:
                    self.stdout.write(f"  [org] {slug} ({c['libelle']}) — {c['nature']}")
                else:
                    if not OrgUnit.objects.filter(slug=slug).exists():
                        OrgUnit.objects.create(
                            kind="branch", slug=slug, name=c["libelle"], parent=groupe,
                        )
                counts["org_units"] += 1

            # ── 3. Apprenants → User (sans Keycloak sub — R13 pending) ──
            slug_decisions = decisions.get("slug_merges", {})
            multi_decisions = decisions.get("multi_client_ref", {})

            for a in data.get("apprenants", []):
                username = a["username"]

                # Skip si la revue dit « fusionner avec un autre »
                if username in slug_decisions and slug_decisions[username].get("action") == "merge_into":
                    counts["skipped"] += 1
                    continue

                email = a.get("email")  # renseigné post-collecte
                if not email:
                    if not dry:
                        self.stdout.write(
                            self.style.WARNING(f"  [user] {username} — pas d'email, skippé (R13)")
                        )
                    counts["skipped"] += 1
                    continue

                if dry:
                    self.stdout.write(f"  [user] {username} <{email}> — {a['nom']} {a['prenom']}")
                else:
                    User.objects.update_or_create(
                        email=email,
                        defaults={
                            "keycloak_sub": f"pending:{username}",  # remplacé à l'ouverture KC
                            "first_name": a.get("prenom", ""),
                            "last_name": a.get("nom", ""),
                        },
                    )
                counts["users"] += 1

            # ── 4. Formations → lms.Course ──────────────────────────────
            from lms.models import Course

            for f in data.get("formations", []):
                code = f.get("code") or ""
                title = f.get("designation", "")
                brand = (f.get("marque") or "").lower().replace("_", "-")
                if dry:
                    self.stdout.write(f"  [course] {code or '(no-code)'} — {title[:60]}")
                else:
                    Course.objects.update_or_create(
                        title=title,
                        brand=brand,
                        defaults={"published": False},
                    )
                counts["formations"] += 1

            if dry:
                self.stdout.write(self.style.WARNING("\n=== DRY RUN terminé — rollback ==="))
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            f"\nImport {'(dry-run) ' if dry else ''}terminé :\n"
            f"  Marques:    {counts['brands']}\n"
            f"  Org units:  {counts['org_units']}\n"
            f"  Users:      {counts['users']} (skippés: {counts['skipped']})\n"
            f"  Formations: {counts['formations']}"
        ))
