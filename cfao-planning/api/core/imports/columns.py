"""Règle 1 du patron d'import : en-têtes par synonymes, jamais par position.

Les fichiers viennent d'une vingtaine de filiales avec autant de conventions de
nommage. Une colonne est donc reconnue par un jeu de libellés acceptés, insensible
à la casse, aux accents, aux espaces multiples et aux tirets.

Voir docs/PATRON_IMPORT_TABULAIRE.md §2.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field


def normalize_header(raw: str) -> str:
    """« Trimestre 1 » → « trimestre1 » · « Code-Formation » → « codeformation »."""
    if raw is None:
        return ""
    text = unicodedata.normalize("NFKD", str(raw))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", text.lower())


@dataclass(frozen=True)
class Column:
    key: str
    labels: tuple[str, ...]
    required: bool = True
    help_text: str = ""
    allowed: tuple[str, ...] = ()

    @property
    def canonical(self) -> str:
        """Le premier libellé est celui qu'on écrit dans le modèle vierge."""
        return self.labels[0]

    def matches(self, header: str) -> bool:
        norm = normalize_header(header)
        return any(normalize_header(label) == norm for label in self.labels)


class MissingColumns(Exception):
    """Colonnes obligatoires introuvables — l'import s'arrête AVANT toute écriture."""

    def __init__(self, missing: list[Column], seen: list[str]):
        self.missing = missing
        self.seen = seen
        attendus = " · ".join(
            f"« {c.canonical} » (ou {', '.join(c.labels[1:])})" if len(c.labels) > 1
            else f"« {c.canonical} »"
            for c in missing
        )
        lus = ", ".join(f"« {h} »" for h in seen if h) or "aucun"
        super().__init__(
            f"Colonnes obligatoires introuvables : {attendus}. "
            f"En-têtes lus dans le fichier : {lus}. "
            f"Téléchargez le modèle vierge pour repartir d'un fichier conforme."
        )


@dataclass
class ColumnSpec:
    columns: list[Column] = field(default_factory=list)

    def resolve(self, headers: list[str]) -> tuple[dict[str, int], list[str]]:
        """Associe chaque colonne connue à son index.

        Renvoie `(index_par_clé, colonnes_inconnues)`. Les colonnes inconnues ne sont
        jamais une erreur : elles sont ignorées et listées au rapport.
        """
        mapping: dict[str, int] = {}
        claimed: set[int] = set()

        for column in self.columns:
            for idx, header in enumerate(headers):
                if idx in claimed:
                    continue
                if column.matches(header):
                    mapping[column.key] = idx
                    claimed.add(idx)
                    break

        missing = [c for c in self.columns if c.required and c.key not in mapping]
        if missing:
            raise MissingColumns(missing, headers)

        unknown = [h for i, h in enumerate(headers) if i not in claimed and h]
        return mapping, unknown

    def by_key(self, key: str) -> Column | None:
        return next((c for c in self.columns if c.key == key), None)
