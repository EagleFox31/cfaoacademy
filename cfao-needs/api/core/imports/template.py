"""Règle 2 : modèle vierge téléchargeable, généré depuis la MÊME définition de
colonnes que le parseur — il ne peut donc pas diverger.
"""
from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from .columns import ColumnSpec

_HEADER_FILL = PatternFill("solid", fgColor="1F2937")
_HEADER_FONT = Font(color="FFFFFF", bold=True, size=10)


def build_template(spec: ColumnSpec, sheet_title: str, example: dict | None = None) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = sheet_title[:31]

    for index, column in enumerate(spec.columns, start=1):
        cell = sheet.cell(row=1, column=index, value=column.canonical)
        cell.fill = _HEADER_FILL
        cell.font = _HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        sheet.column_dimensions[cell.column_letter].width = max(14, min(38, len(column.canonical) + 6))

    if example:
        for index, column in enumerate(spec.columns, start=1):
            sheet.cell(row=2, column=index, value=example.get(column.key, ""))

    sheet.freeze_panes = "A2"

    help_sheet = workbook.create_sheet("Aide")
    help_sheet.append(["Colonne", "Obligatoire", "Valeurs acceptées", "Autres intitulés reconnus"])
    for cell in help_sheet[1]:
        cell.fill = _HEADER_FILL
        cell.font = _HEADER_FONT
    for column in spec.columns:
        help_sheet.append([
            column.canonical,
            "oui" if column.required else "non",
            " · ".join(column.allowed) if column.allowed else (column.help_text or "texte libre"),
            " · ".join(column.labels[1:]) if len(column.labels) > 1 else "",
        ])
    for letter, width in (("A", 28), ("B", 14), ("C", 60), ("D", 44)):
        help_sheet.column_dimensions[letter].width = width

    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
