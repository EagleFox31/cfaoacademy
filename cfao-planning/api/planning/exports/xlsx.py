"""Sorties officielles de la clé en .xlsx (SPEC §8, sorties) : la synthèse
« GLOBAL » pays × marque et une feuille par pays, comme le classeur métier.

Le fichier reste un vrai tableur : volets figés, filtres, formats monétaires et
une ligne de totaux en formules SUM (le lecteur peut recalculer). Les montants
viennent du service : aucune règle de calcul n'est dupliquée ici.
"""
from __future__ import annotations

import io

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

MONEY = '#,##0'
INT = '#,##0'
PCT = '0.0%'
_HEAD_FILL = PatternFill("solid", fgColor="0E1126")
_HEAD_FONT = Font(bold=True, color="FFFFFF")
_TOTAL_FILL = PatternFill("solid", fgColor="E8ECF4")
_THIN = Side(style="thin", color="C9CED8")
_BORDER = Border(top=_THIN, bottom=_THIN, left=_THIN, right=_THIN)

LABELS = {
    "fr": {
        "global": "GLOBAL", "country": "Pays", "technicians": "Techniciens", "needs": "Besoins",
        "seats": "Places", "coverage": "Couverture", "share": "Part", "key_cost": "Coût clé",
        "trainee_lodging": "Hébergement stagiaires", "trainer_lodging": "Hébergement formateurs",
        "total": "Total à payer", "brand": "Marque", "code": "Code", "title": "Module",
        "start": "Début", "end": "Fin", "trainers": "Formateurs", "location": "Lieu",
        "totals": "TOTAL", "planned": "Prévu", "actual": "Réalisé", "frozen": "gelée",
        "draft": "brouillon", "all_poles": "TOUS PÔLES",
    },
    "en": {
        "global": "GLOBAL", "country": "Country", "technicians": "Technicians", "needs": "Needs",
        "seats": "Seats", "coverage": "Coverage", "share": "Share", "key_cost": "Key cost",
        "trainee_lodging": "Trainee lodging", "trainer_lodging": "Trainer lodging",
        "total": "Total due", "brand": "Brand", "code": "Code", "title": "Module",
        "start": "Start", "end": "End", "trainers": "Trainers", "location": "Location",
        "totals": "TOTAL", "planned": "Planned", "actual": "Actual", "frozen": "frozen",
        "draft": "draft", "all_poles": "ALL DIVISIONS",
    },
}


def _labels(lang: str) -> dict:
    return LABELS.get(lang, LABELS["fr"])


def _title_row(ws, text: str, width: int) -> None:
    ws.append([text])
    ws.cell(row=1, column=1).font = Font(bold=True, size=13)
    if width > 1:
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=width)


def _header(ws, row: int, headers: list[str]) -> None:
    for col, text in enumerate(headers, start=1):
        cell = ws.cell(row=row, column=col, value=text)
        cell.fill, cell.font, cell.border = _HEAD_FILL, _HEAD_FONT, _BORDER
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[row].height = 32


def _widths(ws, widths: list[int]) -> None:
    for col, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(col)].width = width


def _totals(ws, row: int, first: int, last: int, sum_cols: dict[int, str], label: str) -> None:
    ws.cell(row=row, column=1, value=label)
    for col, fmt in sum_cols.items():
        letter = get_column_letter(col)
        cell = ws.cell(row=row, column=col, value=f"=SUM({letter}{first}:{letter}{last})"
                       if last >= first else 0)
        cell.number_format = fmt
    for col in range(1, ws.max_column + 1):
        cell = ws.cell(row=row, column=col)
        cell.font, cell.fill, cell.border = Font(bold=True), _TOTAL_FILL, _BORDER


def _heading(table: dict, t: dict) -> str:
    mode = t["planned"] if table["mode"] == "PLANNED" else t["actual"]
    status = t["frozen"] if table["status"] == "FROZEN" else t["draft"]
    pole = t["all_poles"] if table["pole"] == "ALL" else table["pole"]
    return f"{pole} {table['year']} · {mode} · {status}"


def write_global(ws, table: dict, lang: str = "fr") -> None:
    t = _labels(lang)
    brands = table["brands"]
    fixed = ["country", "technicians", "needs", "seats", "coverage", "share", "key_cost",
             "trainee_lodging", "trainer_lodging", "total"]
    headers = [t[k] for k in fixed] + [f"{b['label']} · {t['seats']}" for b in brands]
    ws.title = t["global"]
    _title_row(ws, f"{t['global']} {_heading(table, t)}", len(headers))
    _header(ws, 2, headers)
    first = 3
    for row in table["rows"]:
        values = [row["label"], row["technicians"], row["needs"], row["seats"], row["coverage"],
                  row["share"], row["key_cost"], row["trainee_lodging"], row["trainer_lodging"],
                  row["total"]] + [row["cells"][b["code"]]["seats"] for b in brands]
        ws.append(values)
    last = ws.max_row
    formats = {2: INT, 3: INT, 4: INT, 5: PCT, 6: PCT, 7: MONEY, 8: MONEY, 9: MONEY, 10: MONEY}
    for r in range(first, last + 1):
        for col in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=col)
            cell.border = _BORDER
            cell.number_format = formats.get(col, INT)
    sums = {c: formats.get(c, INT) for c in (2, 3, 4, 6, 7, 8, 9, 10)}
    sums.update({c: INT for c in range(11, len(headers) + 1)})
    _totals(ws, last + 1, first, last, sums, t["totals"])
    ws.freeze_panes = "B3"
    if last >= first:
        ws.auto_filter.ref = f"A2:{get_column_letter(len(headers))}{last}"
    _widths(ws, [24, 12, 10, 10, 12, 10, 16, 16, 16, 16] + [14] * len(brands))


def write_country(ws, sheet: dict, lang: str = "fr") -> None:
    t = _labels(lang)
    headers = [t["brand"], t["code"], t["title"], t["start"], t["end"], t["trainers"],
               t["location"], t["seats"]]
    ws.title = sheet["label"][:31]
    _title_row(ws, f"{sheet['label']} · {_heading(sheet, t)}", len(headers))
    _header(ws, 2, headers)
    first = 3
    for s in sheet["sessions"]:
        ws.append([s["brand"], s["code"], s["title"], s["start_date"], s["end_date"],
                   s["trainers"], s["location"], s["seats"]])
    last = ws.max_row
    for r in range(first, last + 1):
        for col in range(1, len(headers) + 1):
            ws.cell(row=r, column=col).border = _BORDER
        ws.cell(row=r, column=4).number_format = "dd/mm/yyyy"
        ws.cell(row=r, column=5).number_format = "dd/mm/yyyy"
    _totals(ws, last + 1, first, last, {8: INT}, t["totals"])
    footer = sheet["footer"]
    row = last + 3
    for key, fmt in (("share", PCT), ("key_cost", MONEY), ("trainee_lodging", MONEY),
                     ("trainer_lodging", MONEY), ("total", MONEY)):
        ws.cell(row=row, column=7, value=t[key]).font = Font(bold=True)
        cell = ws.cell(row=row, column=8, value=footer[key])
        cell.number_format = fmt
        cell.font = Font(bold=key == "total")
        row += 1
    ws.freeze_panes = "A3"
    if last >= first:
        ws.auto_filter.ref = f"A2:H{last}"
    _widths(ws, [16, 14, 44, 12, 12, 28, 16, 10])


def _bytes(wb: Workbook) -> bytes:
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def global_workbook(table: dict, lang: str = "fr") -> bytes:
    wb = Workbook()
    write_global(wb.active, table, lang)
    return _bytes(wb)


def country_workbook(sheet: dict, lang: str = "fr") -> bytes:
    wb = Workbook()
    write_country(wb.active, sheet, lang)
    return _bytes(wb)


def full_workbook(table: dict, sheets: list[dict], lang: str = "fr") -> bytes:
    """Le classeur complet : GLOBAL puis une feuille par pays ayant des places."""
    wb = Workbook()
    write_global(wb.active, table, lang)
    for sheet in sheets:
        write_country(wb.create_sheet(), sheet, lang)
    return _bytes(wb)
