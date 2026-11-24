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
# Autres couleurs de la légende de la grille, gardées pour le calendrier seulement :
# le prévisionnel de la clé ne lit que `SITE_BY_FILL`.
KIND_BY_FILL = {
    **SITE_BY_FILL,
    "theme:9:0": "trainers", "rgb:FF92D050": "trainers", "rgb:FF70AD47": "trainers",
    "rgb:FF66FF66": "support",
    "rgb:FF00B0F0": "client", "rgb:FF0070C0": "client",
    "theme:1:0": "leave",
}
HOLIDAY_FILL = "rgb:FF7030A0"
HOLIDAY_SECTION = "JOURS FERIES"
# Un jour férié peint toute la colonne du mois ; une case violette isolée n'en est pas un.
_HOLIDAY_MIN_CELLS = 2
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
        spans, covered, painted = [], set(), {}
        for merge in ws.merged_cells.ranges:
            if merge.min_col not in days or merge.min_row <= header:
                continue
            for col in range(merge.min_col, merge.max_col + 1):
                covered.add((merge.min_row, col))
            spans.append((merge.min_row, merge.min_col, merge.max_col, merge.coord.split(":")[0]))
        day_one = next((col for col, day in days.items() if day == 1), None)
        for row in range(header + 1, ws.max_row + 1):
            for col in days:
                cell = ws.cell(row, col)
                # Une case peinte sans texte au 1er du mois peut être la suite d'une session.
                key = fill_key(cell)
                if key == HOLIDAY_FILL and row in month_of:
                    painted[(month_of[row], days[col])] = painted.get((month_of[row], days[col]), 0) + 1
                if (row, col) not in covered and (
                        cell.value is not None or (col == day_one and key in KIND_BY_FILL)):
                    spans.append((row, col, col, cell.coordinate))
        if len(spans) > settings.IMPORT_MAX_ROWS:
            raise TooManyRows(f"Grille trop volumineuse : plus de {settings.IMPORT_MAX_ROWS} bandes.")

        first_row: dict[int, int] = {}
        for r, m in sorted(month_of.items()):
            first_row.setdefault(m, r)
        month_ends: dict[int, dict] = {}  # ligne → bande qui finit le dernier jour de son mois
        for row, min_col, max_col, coord in sorted(spans):
            cell = ws.cell(row, min_col)
            key = fill_key(cell)
            text = _clean(cell.value)
            month = month_of.get(row)
            if key not in KIND_BY_FILL or month is None:
                continue
            start_day, end_day = days[min_col], days.get(max_col, days[min_col])
            previous = self._previous_month_band(row, month, start_day, first_row, month_ends)
            # Session à cheval sur deux mois : la suite, même ligne du formateur au mois suivant,
            # est vide ou ne reprend que le code (« H11 » pour « H11 - Togo ») ; elle hérite du texte.
            inherited = bool(previous and previous["fill_key"] == key
                             and norm_compact(previous["text"]).startswith(norm_compact(text)))
            if inherited:
                text = previous["text"]
            if not text:
                continue
            result.rows_read += 1
            last = calendar.monthrange(self.year, month)[1]
            if end_day > last or end_day < start_day:
                result.extra.setdefault("out_of_month", []).append(f"{ws.title}!{coord}")
                continue
            below = ws.cell(row + 1, min_col)
            title = _clean(below.value) if fill_key(below) not in KIND_BY_FILL else ""
            if inherited and not title:
                title = previous["title"]
            section, brands_raw, trainer_raw = self._line(ws, row, month_of)
            start, end = date(self.year, month, start_day), date(self.year, month, end_day)
            if end_day == last:
                month_ends[row] = {"fill_key": key, "text": text, "title": title}
            result.rows.append({
                "year": self.year, "pole": pole, "sheet": ws.title, "cell": coord,
                "start_date": start, "end_date": end, "text": text[:255], "title": title[:500],
                "fill_key": key, "section": section[:96], "brands_raw": brands_raw[:255],
                "trainer_raw": trainer_raw[:128],
                "fingerprint": _fingerprint(self.year, pole, ws.title, coord, start, end, text, trainer_raw),
            })
        self._holidays(ws, pole, painted, result)

    def _holidays(self, ws, pole: str, painted: dict, result: ParseResult):
        """Jours fériés : une bande d'un jour par date, sans formateur."""
        for (month, day), count in sorted(painted.items()):
            if count < _HOLIDAY_MIN_CELLS or day > calendar.monthrange(self.year, month)[1]:
                continue
            when, cell = date(self.year, month, day), f"{month:02d}-{day:02d}"
            result.rows.append({
                "year": self.year, "pole": pole, "sheet": ws.title, "cell": cell,
                "start_date": when, "end_date": when, "text": "Jour férié", "title": "",
                "fill_key": HOLIDAY_FILL, "section": HOLIDAY_SECTION, "brands_raw": "", "trainer_raw": "",
                "fingerprint": _fingerprint(self.year, pole, ws.title, cell, when, when, "Jour férié", ""),
            })

    @staticmethod
    def _previous_month_band(row: int, month: int, start_day: int, first_row: dict[int, int],
                             month_ends: dict[int, dict]) -> dict | None:
        """La bande qui finit le dernier jour du mois d'avant, à la même ligne de son bloc."""
        if start_day != 1 or month - 1 not in first_row:
            return None
        return month_ends.get(first_row[month - 1] + row - first_row[month])

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
