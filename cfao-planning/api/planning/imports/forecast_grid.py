"""Import C — bandes de session de la grille « Plannings formateurs » (le prévisionnel).

La grille de l'année est le calendrier prévisionnel : chaque session placée y est une bande
peinte (orange = en filiale, jaune = à l'Academy de Douala) sur la ligne du formateur, avec
l'intitulé sur la ligne du dessous. Cet import en garde une copie brute (`GridBand`) ; le
rapprochement avec les sessions de la clé se calcule à la lecture
(`services.forecast_schedule`), si bien qu'un référentiel corrigé plus tard s'applique aussi
aux grilles déjà chargées.

Il ne touche ni `Session`, ni `PlannedSession`, ni l'import `calendar_grid`. Idempotent :
une bande déjà connue (même empreinte) n'est pas réécrite ; une nouvelle version de la
grille retire les bandes disparues de son année et de son pôle, jamais sur un lot vide.
"""
from __future__ import annotations

import calendar
import hashlib
import re
from datetime import date
from typing import BinaryIO

from django.conf import settings

from core.imports.base import ParseResult, TabularImporter, TooManyRows
from referential.models import Pole
from referential.normalize import norm_compact, norm_key

from ..models import GridBand
from .calendar_grid import CalendarGridImporter, fill_key

ACADEMY, SUBSIDIARY = "academy", "subsidiary"
# Mêmes couleurs que `seed_referential` : jaune = Academy de Douala, orange = filiale.
SITE_BY_FILL = {"rgb:FFFFFF00": ACADEMY, "rgb:FFFFC000": SUBSIDIARY}
POLE_BY_SHEET = {
    "calendrier-motors": Pole.MOTORS, "calendrier-mobility": Pole.MOTORS,
    "calendrier-equipment": Pole.EQUIPMENT,
}
# Lignes de la colonne C qui ne sont pas des formateurs.
_NOT_TRAINERS = {"AUTRE", "FORMATEURS", "FORMATION CONSTRUCTEUR", "FORMATIONS CONSTRUCTEUR"}
_HEADERS = {"MOIS", "MARQUES", "FORMATEURS"}
_YEAR = re.compile(r"\b(20\d\d)\b")


def _fingerprint(year: int, pole: str, sheet: str, cell: str, start: date, end: date,
                 text: str, trainer_raw: str) -> str:
    payload = "|".join([str(year), pole, sheet, cell, start.isoformat(), end.isoformat(),
                        norm_compact(text), norm_key(trainer_raw)])
    return hashlib.sha256(payload.encode()).hexdigest()


def _clean(value) -> str:
    return re.sub(r"\s+", " ", str(value)).strip() if value is not None else ""


class ForecastGridImporter(TabularImporter):
    """`year` est un paramètre : la grille ne porte que le mois."""

    kind = "forecast_grid"

    def __init__(self, year: int):
        if year < 2000 or year > 2100:
            raise ValueError("Année de planning hors plage.")
        self.year = year

    def parse(self, stream: BinaryIO) -> ParseResult:
        from openpyxl import load_workbook

        result = ParseResult(kind=self.kind)
        workbook = load_workbook(stream, data_only=False)
        names = [n for n in workbook.sheetnames if n.strip().lower() in POLE_BY_SHEET]
        if not names:
            result.fatal = "NO_CALENDAR"
            return result
        poles = []
        try:
            for name in names:
                ws = workbook[name]
                found = _YEAR.search(_clean(ws["A1"].value))
                if found and int(found.group(1)) != self.year:
                    result.fatal = "YEAR_MISMATCH"
                    result.extra["sheet_year"] = int(found.group(1))
                    break
                pole = str(POLE_BY_SHEET[name.strip().lower()])
                poles.append(pole)
                self._bands(ws, pole, result)
                if result.fatal:
                    break
        except TooManyRows as exc:
            result.fatal = str(exc)
        result.extra.update({"year": self.year, "sheets": names, "poles": sorted(set(poles)),
                             "bands": len(result.rows)})
        return result

    def _bands(self, ws, pole: str, result: ParseResult):
        header = CalendarGridImporter._header_row(ws)
        if header is None:
            result.fatal = "NO_HEADER"
            result.extra["sheet"] = ws.title
            return
        days = {}
        for col in range(1, ws.max_column + 1):
            value = ws.cell(header, col).value
            if isinstance(value, int) and 1 <= value <= 31:
                days[col] = value
        month_of = CalendarGridImporter._months(ws)
        spans, covered = [], set()
        for merge in ws.merged_cells.ranges:
            if merge.min_col not in days or merge.min_row <= header:
                continue
            for col in range(merge.min_col, merge.max_col + 1):
                covered.add((merge.min_row, col))
            spans.append((merge.min_row, merge.min_col, merge.max_col, merge.coord.split(":")[0]))
        for row in range(header + 1, ws.max_row + 1):
            for col in days:
                if (row, col) not in covered and ws.cell(row, col).value is not None:
                    spans.append((row, col, col, ws.cell(row, col).coordinate))
        if len(spans) > settings.IMPORT_MAX_ROWS:
            raise TooManyRows(f"Grille trop volumineuse : plus de {settings.IMPORT_MAX_ROWS} bandes.")

        for row, min_col, max_col, coord in sorted(spans):
            cell = ws.cell(row, min_col)
            key = fill_key(cell)
            text = _clean(cell.value)
            if key not in SITE_BY_FILL or not text:
                continue
            month = month_of.get(row)
            if month is None:
                continue
            result.rows_read += 1
            start_day, end_day = days[min_col], days.get(max_col, days[min_col])
            last = calendar.monthrange(self.year, month)[1]
            if end_day > last or end_day < start_day:
                result.extra.setdefault("out_of_month", []).append(f"{ws.title}!{coord}")
                continue
            below = ws.cell(row + 1, min_col)
            title = _clean(below.value) if fill_key(below) not in SITE_BY_FILL else ""
            section, brands_raw, trainer_raw = self._line(ws, row, month_of)
            start, end = date(self.year, month, start_day), date(self.year, month, end_day)
            result.rows.append({
                "year": self.year, "pole": pole, "sheet": ws.title, "cell": coord,
                "start_date": start, "end_date": end, "text": text[:255], "title": title[:500],
                "fill_key": key, "section": section[:96], "brands_raw": brands_raw[:255],
                "trainer_raw": trainer_raw[:128],
                "fingerprint": _fingerprint(self.year, pole, ws.title, coord, start, end, text, trainer_raw),
            })

    @staticmethod
    def _line(ws, row: int, month_of: dict[int, int]) -> tuple[str, str, str]:
        """(section, marques, formateur) : la ligne la plus proche au-dessus, même mois, dont
        la colonne B ou C est écrite. Une ligne « Formations reportées » n'a pas de formateur."""
        month = month_of.get(row)
        for cursor in range(row, 0, -1):
            if month_of.get(cursor) != month:
                break
            brands, trainer = _clean(ws.cell(cursor, 2).value), _clean(ws.cell(cursor, 3).value)
            if not brands and not trainer:
                continue
            if norm_key(brands) in _HEADERS or norm_key(trainer) in _HEADERS:
                break
            return (norm_key(brands), brands,
                    "" if norm_key(trainer) in _NOT_TRAINERS else trainer)
        return "", "", ""

    def write(self, rows: list[dict], log) -> int:
        written = 0
        seen = set()
        for row in rows:
            seen.add(row["fingerprint"])
            _, created = GridBand.objects.get_or_create(
                fingerprint=row["fingerprint"],
                defaults={**{k: v for k, v in row.items() if k != "fingerprint"}, "import_log": log},
            )
            written += int(created)
        removed = 0
        poles = {r["pole"] for r in rows}
        if rows:  # un lot vide ne vide jamais la grille connue
            stale = GridBand.objects.filter(year=self.year, pole__in=poles).exclude(fingerprint__in=seen)
            removed, _ = stale.delete()
            written += removed
        self.report_extra = {"created": written - removed, "removed": removed,
                             "kept": len(seen) - (written - removed)}
        return written
