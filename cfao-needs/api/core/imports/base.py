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

    def as_dict(self) -> dict:
        return {
            "row": self.row,
            "column": self.column,
            "value": self.value,
            "code": self.code,
            "message": self.message,
        }


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

    @property
    def ok(self) -> bool:
        return not self.fatal and not self.errors

    def as_report(self) -> dict:
        return {
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
            result.rows.append(cleaned)

        return result

    # ── écriture ──────────────────────────────────────────────────────────────
    def apply(self, result: ParseResult, actor: str = "") -> "ImportLog":  # noqa: F821
        """Règle 4 : tout ou rien. Une seule erreur ⇒ aucune écriture."""
        from .models import ImportLog

        if not result.ok:
            return ImportLog.objects.create(
                kind=self.kind,
                actor=actor,
                status=ImportLog.Status.REJECTED,
                report=result.as_report(),
            )

        with transaction.atomic():
            written = self.write(result.rows)
            return ImportLog.objects.create(
                kind=self.kind,
                actor=actor,
                status=ImportLog.Status.APPLIED,
                rows_written=written,
                report=result.as_report(),
            )

    # ── à implémenter par les sous-classes ───────────────────────────────────
    def clean_row(self, line: int, values: dict, result: ParseResult) -> dict:
        raise NotImplementedError

    def write(self, rows: list[dict]) -> int:
        raise NotImplementedError

    # ── lecture bas niveau ───────────────────────────────────────────────────
    def _read(self, stream: BinaryIO) -> tuple[list[str], list[tuple]]:
        """openpyxl en lecture seule, formules jamais évaluées (patron §5)."""
        from openpyxl import load_workbook

        workbook = load_workbook(stream, read_only=True, data_only=True)
        sheet = workbook.active
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

    def as_row_error(self, line: int) -> RowError:
        return RowError(
            row=line,
            column=self.column,
            value=self.value,
            code=self.code,
            message=str(self),
        )
