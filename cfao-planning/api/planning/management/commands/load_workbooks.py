"""Charge les classeurs déposés sur le serveur, au démarrage (AGENTS.md §7).

Lit les dossiers de `PLANNING_WORKBOOKS_DIRS` (séparés par « : », montés en lecture
seule) et passe chaque classeur reconnu par l'importeur de l'écran Imports :

- « Plannings formateurs AAAA » : grille du calendrier de l'année AAAA, dernière
  version seulement (numéro « V27 », puis date du fichier) ;
- « Clé de Répartition … » / « Répartition de places par pays … » : places par pays,
  de la plus ancienne à la plus récente ;
- « Liste des participants aux formations AAAA » : stagiaires de l'exercice AAAA,
  dernière version seulement (les « Copie de … » sont ignorées).

Idempotent : un fichier déjà vu (même empreinte, même type, mêmes paramètres) n'est
ni relu ni réécrit, qu'il ait été appliqué ou refusé. Un fichier refusé est journalisé
comme un import manuel refusé (écran Imports) et ne bloque jamais le démarrage. Les
fichiers verrous (« ~$ ») et les dossiers « Historique » sont ignorés.
"""
from __future__ import annotations

import hashlib
import os
import re
import unicodedata
from pathlib import Path

from django.core.management.base import BaseCommand

from core.models import ImportLog

from ...imports.attendance_list import AttendanceListImporter
from ...imports.calendar_grid import CalendarGridImporter
from ...imports.seat_sheets import SeatSheetsImporter
from ...models import CostKeyYear
from ...services.cost_key_freeze import FreezeRefused, freeze

ACTOR = "system:chargement-auto"
EXTENSIONS = {".xlsx", ".xlsm"}
_CALENDAR = re.compile(r"plannings? formateurs? (20\d\d)")
_ATTENDANCE = re.compile(r"liste des participants aux formations (20\d\d)")
_SEATS = re.compile(r"cle de repartition|repartition de(s)? places par pays")
_VERSION = re.compile(r"\bv(\d+)\b")


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", text.lower()).strip()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _lisible(root: Path) -> bool:
    """Dossier présent ET parcourable : sinon rglob avale la PermissionError en silence."""
    return root.is_dir() and os.access(root, os.R_OK | os.X_OK)


def discover(roots: list[Path]) -> list[tuple[str, Path, dict]]:
    """(type d'import, fichier, paramètres), dans l'ordre d'application."""
    calendars: dict[int, list[Path]] = {}
    attendance: dict[int, list[Path]] = {}
    seats: list[Path] = []
    for root in roots:
        if not _lisible(root):
            continue
        for path in root.rglob("*"):
            if (path.suffix.lower() not in EXTENSIONS or path.name.startswith("~$")
                    or any(_norm(p) == "historique" for p in path.relative_to(root).parts[:-1])
                    or not path.is_file()):
                continue
            name = _norm(path.stem)
            if match := _CALENDAR.search(name):
                calendars.setdefault(int(match.group(1)), []).append(path)
            elif (match := _ATTENDANCE.search(name)) and not name.startswith("copie de"):
                attendance.setdefault(int(match.group(1)), []).append(path)
            elif _SEATS.search(name):
                seats.append(path)

    def version(path: Path) -> tuple[int, float]:
        found = _VERSION.findall(_norm(path.stem))
        return (int(found[-1]) if found else 0, path.stat().st_mtime)

    plan = [("seat_allocations", p, {}) for p in sorted(seats, key=lambda p: p.stat().st_mtime)]
    plan += [("calendar_grid", max(paths, key=version), {"year": str(year)})
             for year, paths in sorted(calendars.items())]
    plan += [("attendance_list", max(paths, key=version), {"year": str(year)})
             for year, paths in sorted(attendance.items())]
    return plan


def _importer(kind: str, params: dict):
    if kind == "calendar_grid":
        return CalendarGridImporter(int(params["year"]))
    if kind == "attendance_list":
        return AttendanceListImporter(int(params["year"]))
    return SeatSheetsImporter()


class Command(BaseCommand):
    help = "Charge les classeurs du partage (calendriers, clés de répartition). Idempotent."

    def add_arguments(self, parser):
        parser.add_argument("dirs", nargs="*", help="Dossiers à lire (défaut : PLANNING_WORKBOOKS_DIRS).")

    def handle(self, *args, **options):
        raw = options["dirs"] or [d for d in os.environ.get("PLANNING_WORKBOOKS_DIRS", "").split(":") if d]
        roots = [Path(d) for d in raw]
        if not roots:
            self.stdout.write("Aucun dossier de classeurs configuré : rien à charger.")
            return
        for root in roots:
            if not root.is_dir():
                self.stdout.write(f"Dossier absent, ignoré : {root}")
            elif not _lisible(root):
                self.stdout.write(f"Dossier illisible (droits), ignoré : {root}")

        for kind, path, params in discover(roots):
            sha = _sha256(path)
            if ImportLog.objects.filter(kind=kind, file_sha256=sha, params=params).exists():
                continue  # déjà appliqué ou déjà refusé : rien à refaire
            importer = _importer(kind, params)
            try:
                with path.open("rb") as stream:
                    result = importer.parse(stream)
                log = importer.apply(result, actor=ACTOR, file_sha256=sha, params=params)
            except Exception as exc:  # un classeur illisible ne bloque pas le démarrage
                ImportLog.objects.create(
                    kind=kind, actor=ACTOR, status=ImportLog.Status.REJECTED,
                    report={"kind": kind, "status": "REJECTED", "fatal": f"Classeur illisible : {exc}",
                            "file": path.name},
                    file_sha256=sha, params=params,
                )
                self.stdout.write(f"{kind} {path.name} : illisible ({exc})")
                continue
            self.stdout.write(f"{kind} {path.name} : {log.status} ({log.rows_written} lignes écrites)")

        self._freeze_closed_years()

    def _freeze_closed_years(self):
        """Exercices clos (`PLANNING_CLOSED_YEARS`, ex. « 2026 ») : prévu gelé une fois
        chargé, comme le bouton « Figer ». Déjà gelé à l'identique = no-op ; clé vide ou
        budget mal réparti = signalé, le démarrage continue."""
        years = [int(y) for y in os.environ.get("PLANNING_CLOSED_YEARS", "").replace(",", " ").split()]
        for key in CostKeyYear.objects.filter(year__in=years).order_by("year", "pole"):
            try:
                freeze(key, ACTOR)
            except FreezeRefused as exc:
                self.stdout.write(f"Gel {key} non fait : {exc}")
