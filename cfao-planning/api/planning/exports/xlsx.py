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

from ..services.cost_key_global import AT_ACADEMY, IN_SUBSIDIARY, PLACE_KEYS, POSTPONED

MONEY = '#,##0 "FCFA"'
INT = '#,##0'
PCT = '0.0%'
_HEAD_FILL = PatternFill("solid", fgColor="0E1126")
_HEAD_FONT = Font(bold=True, color="FFFFFF")
_TOTAL_FILL = PatternFill("solid", fgColor="E8ECF4")
# Mêmes couleurs que les cellules de l'écran.
_PLACE_FILLS = {
    IN_SUBSIDIARY: PatternFill("solid", fgColor="BFECD0"),
    AT_ACADEMY: PatternFill("solid", fgColor="C3D8FB"),
    POSTPONED: PatternFill("solid", fgColor="F9C0C7"),
}
_THIN = Side(style="thin", color="C9CED8")
_BORDER = Border(top=_THIN, bottom=_THIN, left=_THIN, right=_THIN)

LABELS = {
    "fr": {
        "global": "GLOBAL", "country": "Pays", "technicians": "Techniciens", "needs": "Besoins",
        "seats": "Places", "in_subsidiary": "En filiale", "at_academy": "À l'Academy", "postponed": "Reportées", "coverage": "Taux de couverture du besoin", "level": "Niveau", "share": "Part", "key_cost": "Coût clé",
        "trainee_lodging": "Frais d'accommodation des stagiaires", "trainer_lodging": "Frais d'accommodation formateurs",
        "total": "Total à payer", "brand": "Marque", "code": "Code", "title": "Module",
        "start": "Début", "end": "Fin", "trainers": "Formateurs", "location": "Lieu",
        "totals": "TOTAL", "planned": "Prévu", "actual": "Réalisé", "frozen": "gelée",
        "draft": "brouillon", "all_poles": "TOUS PÔLES",
    },
    "en": {
        "global": "GLOBAL", "country": "Country", "technicians": "Technicians", "needs": "Needs",
        "seats": "Seats", "in_subsidiary": "In subsidiary", "at_academy": "At the Academy", "postponed": "Postponed", "coverage": "Need coverage rate", "level": "Level", "share": "Share", "key_cost": "Key cost",
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
    # Même ordre que l'onglet « TOUS LES PAYS » du classeur source et que l'écran :
    # pays et techniciens, marques, totaux de places, part, puis l'argent en dernier.
    # (en-tête, valeur, format, sommé en pied, largeur)
    cols = [
        (t["country"], lambda r: r["label"], None, False, 24),
        (t["technicians"], lambda r: r["technicians"], INT, True, 12),
        *[(f"{b['label']} · {t['seats']}", lambda r, c=b["code"]: r["cells"][c]["seats"], INT, True, 14)
          for b in brands],
        (t["needs"], lambda r: r["needs"], INT, True, 10),
        (t["seats"], lambda r: r["seats"], INT, True, 10),
        *[(t[k], lambda r, k=k: r[k], INT, True, 14) for k in PLACE_KEYS],
        (t["coverage"], lambda r: r["coverage"], PCT, False, 16),
        (t["share"], lambda r: r["share"], PCT, True, 10),
        (t["key_cost"], lambda r: r["key_cost"], MONEY, True, 22),
    ]
    ws.title = t["global"]
    _title_row(ws, f"{t['global']} {_heading(table, t)}", len(cols))
    _header(ws, 2, [c[0] for c in cols])
    first = 3
    for row in table["rows"]:
        ws.append([c[1](row) for c in cols])
    last = ws.max_row
    for r in range(first, last + 1):
        for i, (_, _, fmt, _, _) in enumerate(cols, 1):
            cell = ws.cell(row=r, column=i)
            cell.border = _BORDER
            if fmt:
                cell.number_format = fmt
    sums = {i: c[2] for i, c in enumerate(cols, 1) if c[3]}
    _totals(ws, last + 1, first, last, sums, t["totals"])
    ws.freeze_panes = "B3"
    if last >= first:
        ws.auto_filter.ref = f"A2:{get_column_letter(len(cols))}{last}"
    _widths(ws, [c[4] for c in cols])


def write_country(ws, sheet: dict, lang: str = "fr") -> None:
    t = _labels(lang)
    headers = [t["brand"], t["level"], t["code"], t["title"], t["start"], t["end"], t["trainers"],
               t["location"], t["seats"]]
    ws.title = sheet["label"][:31]
    _title_row(ws, f"{sheet['label']} · {_heading(sheet, t)}", len(headers))
    _header(ws, 2, headers)
    first = 3
    for s in sheet["sessions"]:
        ws.append([s["brand"], s["level"] or "", s["code"], s["title"], s["start_date"], s["end_date"],
                   s["trainers"], s["location"], s["seats"]])
    last = ws.max_row
    for r in range(first, last + 1):
        for col in range(1, len(headers) + 1):
            ws.cell(row=r, column=col).border = _BORDER
        ws.cell(row=r, column=5).number_format = "dd/mm/yyyy"
        ws.cell(row=r, column=6).number_format = "dd/mm/yyyy"
    for r, s in enumerate(sheet["sessions"], first):
        ws.cell(row=r, column=9).fill = _PLACE_FILLS[s["seat_status"]]
    _totals(ws, last + 1, first, last, {9: INT}, t["totals"])
    footer = sheet["footer"]
    row = last + 3
    for key, fmt in (*((k, INT) for k in PLACE_KEYS), ("share", PCT), ("key_cost", MONEY),
                     ("trainee_lodging", MONEY), ("trainer_lodging", MONEY), ("total", MONEY)):
        ws.cell(row=row, column=8, value=t[key]).font = Font(bold=True)
        cell = ws.cell(row=row, column=9, value=footer[key])
        cell.number_format = fmt
        if key in _PLACE_FILLS:
            cell.fill = _PLACE_FILLS[key]
        cell.font = Font(bold=key == "total")
        row += 1
    ws.freeze_panes = "A3"
    if last >= first:
        ws.auto_filter.ref = f"A2:I{last}"
    _widths(ws, [16, 10, 14, 44, 12, 12, 28, 16, 22])


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
