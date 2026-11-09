"""Le patron d'import tabulaire — squelette commun à tous les imports du module.

Trois obligations (docs/PATRON_IMPORT_TABULAIRE.md) :
  1. tolérer la forme    → synonymes d'en-têtes, normalisations tracées
  2. refuser le fond douteux → validation ligne à ligne, transaction tout-ou-rien
  3. dire ce qui s'est passé → rapport exhaustif, persistant, téléchargeable

`parse` et `apply` sont **séparés** : c'est ce qui permet la prévisualisation avant
écriture, comportement attendu de tout import destructif.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, BinaryIO

from django.conf import settings
from django.db import transaction

from .columns import ColumnSpec, MissingColumns


@dataclass
class RowError:
    row: int
    column: str
    value: Any
    code: str
    message: str
    # Renseigné par les imports qui lisent plusieurs feuilles d'un même classeur.
    sheet: str = ""

    def as_dict(self) -> dict:
        data = {
            "row": self.row,
            "column": self.column,
            "value": self.value,
            "code": self.code,
            "message": self.message,
        }
        if self.sheet:
            data["sheet"] = self.sheet
        return data


@dataclass
class Normalization:
    """Règle 6 : une valeur corrigée automatiquement est appliquée ET visible."""

    row: int
    column: str
    from_value: Any
    to_value: Any
    rule: str

    def as_dict(self) -> dict:
        return {
            "row": self.row,
            "column": self.column,
            "from": self.from_value,
            "to": self.to_value,
            "rule": self.rule,
        }


@dataclass
class ParseResult:
    kind: str
    rows: list[dict] = field(default_factory=list)
    errors: list[RowError] = field(default_factory=list)
    normalizations: list[Normalization] = field(default_factory=list)
    unknown_columns: list[str] = field(default_factory=list)
    rows_read: int = 0
    fatal: str = ""
    # Constats de lecture propres à un import (feuilles lues, ignorées…), visibles
    # dès la prévisualisation.
    extra: dict = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not self.fatal and not self.errors

    def as_report(self) -> dict:
        return {
            **self.extra,
            "kind": self.kind,
            "status": "OK" if self.ok else "REJECTED",
            "rows_read": self.rows_read,
            "rows_valid": len(self.rows),
            "rows_rejected": len(self.errors),
            "fatal": self.fatal,
            "unknown_columns": self.unknown_columns,
            "normalizations": [n.as_dict() for n in self.normalizations],
            "errors": [e.as_dict() for e in self.errors],
        }


class TooManyRows(Exception):
    pass


class TabularImporter:
    """Classe de base. Une sous-classe déclare ses colonnes, sa clé et sa validation.

    Contrat des sous-classes :
      - `kind`         : identifiant de l'import (route, rapport)
      - `columns`      : ColumnSpec
      - `natural_key`  : tuple de clés — testé sur un jeu contenant un doublon
                         volontaire sur clé partielle (règle 5)
      - `clean_row()`  : valide et normalise une ligne → dict, ou lève `RowRejected`
      - `write()`      : écrit les lignes validées, **dans une transaction**
    """

    kind: str = ""
    columns: ColumnSpec = ColumnSpec()
    natural_key: tuple[str, ...] = ()
    # Feuille à lire. None ⇒ la feuille active. Un classeur métier porte souvent
    # plusieurs feuilles (le planning formateurs : calendriers + « Data »).
    sheet: str | None = None

    # ── lecture ───────────────────────────────────────────────────────────────
    def parse(self, stream: BinaryIO) -> ParseResult:
        result = ParseResult(kind=self.kind)
        try:
            headers, rows = self._read(stream)
        except TooManyRows as exc:
            result.fatal = str(exc)
            return result

        try:
            mapping, unknown = self.columns.resolve(headers)
        except MissingColumns as exc:
            result.fatal = str(exc)
            return result

        result.unknown_columns = unknown
        seen_keys: dict[tuple, int] = {}
        kept: dict[tuple, dict] = {}

        for offset, raw in enumerate(rows):
            # +2 : ligne 1 = en-têtes, et l'utilisateur compte à partir de 1.
            line = offset + 2
            result.rows_read += 1
            values = {key: self._cell(raw, idx) for key, idx in mapping.items()}

            if not any(str(v).strip() for v in values.values() if v is not None):
                continue  # ligne entièrement vide : ignorée sans bruit

            try:
                cleaned = self.clean_row(line, values, result)
            except RowRejected as exc:
                result.errors.append(exc.as_row_error(line))
                continue

            key = tuple(cleaned.get(k) for k in self.natural_key)
            if self.natural_key and key in seen_keys and self.merge_duplicate(
                kept[key], cleaned, line, result
            ):
                continue
            if self.natural_key and key in seen_keys:
                result.errors.append(
                    RowError(
                        row=line,
                        column="/".join(self.natural_key),
                        value=" / ".join("" if v is None else str(v) for v in key),
                        code="DUPLICATE_KEY",
                        message=(
                            f"Ligne en double : cette combinaison existe déjà "
                            f"ligne {seen_keys[key]} du même fichier."
                        ),
                    )
                )
                continue
            if self.natural_key:
                seen_keys[key] = line
                kept[key] = cleaned
            result.rows.append(cleaned)

        return result

    # ── écriture ──────────────────────────────────────────────────────────────
    def apply(
        self, result: ParseResult, actor: str = "", file_sha256: str = "", params: dict | None = None
    ) -> "ImportLog":  # noqa: F821
        """Règle 4 : tout ou rien. Une seule erreur ⇒ aucune écriture.

        Un fichier identique déjà appliqué renvoie son journal sans rien réécrire.
        """
        from .models import ImportLog

        params = params or {}
        if file_sha256:
            previous = ImportLog.objects.filter(
                kind=self.kind, file_sha256=file_sha256, params=params,
                status=ImportLog.Status.APPLIED,
            ).first()
            if previous:
                return previous

        if not result.ok:
            return ImportLog.objects.create(
                kind=self.kind,
                actor=actor,
                status=ImportLog.Status.REJECTED,
                report=result.as_report(),
                file_sha256=file_sha256,
                params=params,
            )

        with transaction.atomic():
            log = ImportLog.objects.create(
                kind=self.kind,
                actor=actor,
                status=ImportLog.Status.APPLIED,
                report=result.as_report(),
                file_sha256=file_sha256,
                params=params,
            )
            self.report_extra = {}
            written = self.write(result.rows, log)
            log.rows_written = written
            # `write` peut compléter le rapport (créés / mis à jour / absents du fichier).
            log.report = {**result.as_report(), **self.report_extra}
            log.save(update_fields=["rows_written", "report"])
            return log

    # ── à implémenter par les sous-classes ───────────────────────────────────
    def clean_row(self, line: int, values: dict, result: ParseResult) -> dict:
        raise NotImplementedError

    def merge_duplicate(self, kept: dict, row: dict, line: int, result: ParseResult) -> bool:
        """Deux lignes de même clé décrivant la même chose : la sous-classe peut les
        fusionner dans `kept` (et le tracer). False ⇒ doublon refusé."""
        return False

    def write(self, rows: list[dict], log) -> int:
        """`log` : le journal en cours, pour rattacher les lignes écrites à leur import."""
        raise NotImplementedError

    # ── lecture bas niveau ───────────────────────────────────────────────────
    def _read(self, stream: BinaryIO) -> tuple[list[str], list[tuple]]:
        """openpyxl en lecture seule, formules jamais évaluées (patron §5)."""
        from openpyxl import load_workbook

        workbook = load_workbook(stream, read_only=True, data_only=True)
        sheet = self._pick_sheet(workbook)
        rows = sheet.iter_rows(values_only=True)
        headers = [self._text(c) for c in next(rows, ()) or ()]

        collected: list[tuple] = []
        limit = settings.IMPORT_MAX_ROWS
        for row in rows:
            if len(collected) >= limit:
                raise TooManyRows(
                    f"Fichier trop volumineux : plus de {limit} lignes. "
                    f"Découpez-le en plusieurs fichiers."
                )
            collected.append(row)
        return headers, collected

    def _pick_sheet(self, workbook):
        """La feuille nommée si elle existe (comparaison normalisée), sinon l'active."""
        if self.sheet:
            from .columns import normalize_header

            wanted = normalize_header(self.sheet)
            for name in workbook.sheetnames:
                if normalize_header(name) == wanted:
                    return workbook[name]
        return workbook.active

    @staticmethod
    def _cell(row: tuple, idx: int):
        return row[idx] if idx < len(row) else None

    @staticmethod
    def _text(value) -> str:
        return "" if value is None else str(value).strip()


class RowRejected(Exception):
    """Levée par `clean_row` — la ligne est refusée, l'import continue de valider."""

    def __init__(self, column: str, value: Any, code: str, message: str):
        self.column = column
        self.value = value
        self.code = code
        super().__init__(message)

    def as_row_error(self, line: int, sheet: str = "") -> RowError:
        return RowError(
            row=line,
            column=self.column,
            value=self.value,
            code=self.code,
            message=str(self),
            sheet=sheet,
        )
