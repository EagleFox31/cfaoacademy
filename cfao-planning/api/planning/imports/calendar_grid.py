"""Import B — grilles « Calendrier-Motors » et « Calendrier-Equipment ».

La grille ne crée jamais de session (SPEC §4). Elle écrit :

- une absence, quand le texte de la bande est un mot-clé du référentiel ;
- le statut ou la catégorie d'une session déjà créée par la feuille Data, quand
  la couleur a une règle et que la bande tombe exactement sur cette session ;
- un élément de revue pour tout le reste (couleur sans règle, bloc absent de
  Data, écart de code, chevauchement, jour hors mois).

Une ligne d'intitulé (règle de couleur `TITLE`) est rattachée à la bande du
dessus. Elle ne devient pas une seconde occupation : c'est le piège du classeur,
où le code et l'intitulé sont peints sur deux lignes.
"""
from __future__ import annotations

import calendar
import hashlib
import re
from dataclasses import dataclass
from datetime import date
from typing import BinaryIO

from django.conf import settings

from core.imports.base import ParseResult, TabularImporter, TooManyRows
from referential.models import AbsenceKeyword, ColorRule
from referential.normalize import norm_compact, norm_key
from referential.resolve import Resolver

from ..models import (
    Absence,
    Category,
    Origin,
    ReviewItem,
    Session,
    SessionStatus,
)

_MONTHS = {
    "JANVIER": 1, "FEVRIER": 2, "MARS": 3, "AVRIL": 4, "MAI": 5, "JUIN": 6,
    "JUILLET": 7, "AOUT": 8, "SEPTEMBRE": 9, "OCTOBRE": 10, "NOVEMBRE": 11,
    "DECEMBRE": 12,
}
_CODE = re.compile(r"[A-Z]{1,8}\d{2,}(?:\s*-\s*[A-Z0-9]+)?")
_SHEETS = ("Calendrier-Motors", "Calendrier-Equipment")
_TITLE = "TITLE"
_HOLIDAY = "HOLIDAY"


@dataclass
class Band:
    sheet: str
    cell: str
    row: int
    month: int
    start_day: int
    end_day: int
    text: str
    title: str
    fill_key: str
    trainer_raw: str
    trainer_id: str | None


def fill_key(cell) -> str:
    """Clé stable de `ColorRule` : on ne recalcule jamais un thème Office en RGB."""
    fill = cell.fill
    if fill is None or fill.patternType in (None, "none"):
        return ""
    color = fill.fgColor
    if color is None or color.type is None:
        return ""
    if color.type == "rgb" and color.rgb and str(color.rgb) not in ("00000000", "0"):
        rgb = str(color.rgb).upper()
        if len(rgb) == 6:
            rgb = "FF" + rgb
        return f"rgb:{rgb}"
    if color.type == "theme":
        return f"theme:{color.theme}:{color.tint or 0}"
    if color.type == "indexed" and color.indexed is not None:
        return f"idx:{color.indexed}"
    return ""


def extract_code(text: str) -> str:
    found = _CODE.search(text.upper())
    if not found:
        return ""
    from referential.normalize import norm_code
    return norm_code(found.group(0))


def _fingerprint(band: Band, reason: str, start: date | None, end: date | None) -> str:
    payload = "|".join([
        band.sheet,
        reason,
        band.trainer_id or norm_key(band.trainer_raw),
        start.isoformat() if start else "",
        end.isoformat() if end else "",
        norm_compact(band.text),
        band.fill_key,
    ])
    return hashlib.sha256(payload.encode()).hexdigest()


class CalendarGridImporter(TabularImporter):
    """`year` est un paramètre : la grille ne porte que le mois, pas l'année."""

    kind = "calendar_grid"

    def __init__(self, year: int):
        if year < 2000 or year > 2100:
            raise ValueError("Année de planning hors plage.")
        self.year = year
        self.resolver = Resolver()
        self._keywords: dict[str, str] = {}
        self._colors: dict[str, ColorRule] = {}

    def parse(self, stream: BinaryIO) -> ParseResult:
        from openpyxl import load_workbook

        result = ParseResult(kind=self.kind)
        self._keywords = {k.pattern_norm: k.kind for k in AbsenceKeyword.objects.all()}
        self._colors = {c.fill_key: c for c in ColorRule.objects.all()}
        workbook = load_workbook(stream, data_only=False)
        names = [name for name in _SHEETS if name in workbook.sheetnames]
        if not names:
            result.fatal = "NO_CALENDAR"
            return result

        colors: dict[str, int] = {}
        try:
            for name in names:
                for band in self._bands(workbook[name], result):
                    if result.fatal:
                        break
                    if band.fill_key:
                        colors[band.fill_key] = colors.get(band.fill_key, 0) + 1
                    self._classify(band, result)
                if result.fatal:
                    break
        except TooManyRows as exc:
            result.fatal = str(exc)
            return result

        if not result.fatal:
            self._mark_overlaps(result)
        result.extra["year"] = self.year
        result.extra["sheets"] = names
        result.extra["colors_found"] = colors
        return result

    # ── lecture de la grille ────────────────────────────────────────────────
    def _bands(self, ws, result: ParseResult):
        header = self._header_row(ws)
        if header is None:
            result.fatal = "NO_HEADER"
            result.extra["sheet"] = ws.title
            return
        days = {}
        for col in range(1, ws.max_column + 1):
            value = ws.cell(header, col).value
            if isinstance(value, int) and 1 <= value <= 31:
                days[col] = value
        month_of = self._months(ws)
        covered = set()
        spans = []
        for merge in ws.merged_cells.ranges:
            if merge.min_col not in days or merge.min_row <= header:
                continue
            for row in range(merge.min_row, merge.max_row + 1):
                for col in range(merge.min_col, merge.max_col + 1):
                    covered.add((row, col))
            text = ws.cell(merge.min_row, merge.min_col).value
            if text is None or not str(text).strip():
                continue
            label = str(text).strip()
            if label == str(days[merge.min_col]):
                continue
            spans.append((merge.min_row, merge.min_col, days[merge.min_col],
                          days.get(merge.max_col, days[merge.min_col]), label,
                          fill_key(ws.cell(merge.min_row, merge.min_col)),
                          merge.coord))
        for row in range(header + 1, ws.max_row + 1):
            for col, day in days.items():
                if (row, col) in covered:
                    continue
                value = ws.cell(row, col).value
                if value is None or not str(value).strip():
                    continue
                if str(value).strip() == str(day):
                    continue
                cell = ws.cell(row, col)
                spans.append((row, col, day, day, str(value).strip(), fill_key(cell), cell.coordinate))

        spans.sort()
        if len(spans) > settings.IMPORT_MAX_ROWS:
            raise TooManyRows(
                f"Grille trop volumineuse : plus de {settings.IMPORT_MAX_ROWS} bandes."
            )
        consumed = set()
        for index, span in enumerate(spans):
            if index in consumed:
                continue
            row, col, start_day, end_day, text, key, coord = span
            title = ""
            rule = self._colors.get(key)
            if rule and rule.category == _TITLE:
                continue
            for other in range(index + 1, len(spans)):
                orow, _ocol, ostart, oend, otext, okey, _ocoord = spans[other]
                if orow > row + 1:
                    break
                if orow != row + 1 or ostart != start_day:
                    continue
                orule = self._colors.get(okey)
                if orule and orule.category == _TITLE and (oend == end_day or oend == ostart):
                    title = otext
                    consumed.add(other)
                    break
            month = month_of.get(row)
            if month is None:
                continue
            trainer_raw = self._trainer(ws, row, month_of)
            match = self.resolver.trainer(trainer_raw) if trainer_raw else None
            yield Band(
                sheet=ws.title, cell=coord.split(":")[0], row=row, month=month,
                start_day=start_day, end_day=end_day, text=text, title=title,
                fill_key=key, trainer_raw=trainer_raw,
                trainer_id=str(match.obj.pk) if match else None,
            )

    @staticmethod
    def _header_row(ws) -> int | None:
        for row in range(1, min(ws.max_row, 15) + 1):
            values = [ws.cell(row, col).value for col in range(1, min(ws.max_column, 40) + 1)]
            if 1 in values and 31 in values:
                return row
        return None

    @staticmethod
    def _months(ws) -> dict[int, int]:
        found: dict[int, int] = {}
        current = None
        for row in range(1, ws.max_row + 1):
            raw = ws.cell(row, 1).value
            key = norm_key(raw)
            if key in _MONTHS:
                current = _MONTHS[key]
            if current is not None:
                found[row] = current
        for merge in ws.merged_cells.ranges:
            if merge.min_col == 1 and merge.min_row in found:
                for row in range(merge.min_row, merge.max_row + 1):
                    found[row] = found[merge.min_row]
        return found

    @staticmethod
    def _trainer(ws, row: int, month_of: dict[int, int]) -> str:
        month = month_of.get(row)
        for cursor in range(row, 0, -1):
            if month_of.get(cursor) != month:
                break
            value = ws.cell(cursor, 3).value
            if value and str(value).strip() and norm_key(value) != "FORMATEURS":
                return str(value).strip()
        return ""

    # ── classement ──────────────────────────────────────────────────────────
    def _dates(self, band: Band) -> tuple[date, date] | None:
        last = calendar.monthrange(self.year, band.month)[1]
        if band.start_day < 1 or band.end_day > last or band.end_day < band.start_day:
            return None
        return date(self.year, band.month, band.start_day), date(self.year, band.month, band.end_day)

    def _classify(self, band: Band, result: ParseResult):
        result.rows_read += 1
        span = self._dates(band)
        if span is None:
            self._review(result, band, ReviewItem.Reason.CODE_UNPARSEABLE, None, None,
                         {"text": band.text}, {})
            return
        start, end = span
        keyword = self._keywords.get(norm_compact(band.text))
        rule = self._colors.get(band.fill_key)
        if keyword is None and rule is not None and rule.category == _HOLIDAY:
            keyword = AbsenceKeyword.Kind.HOLIDAY
        if keyword:
            if not band.trainer_id:
                self._review(result, band, ReviewItem.Reason.CODE_UNPARSEABLE, start, end,
                             {"text": band.text, "trainer": band.trainer_raw}, {})
                return
            result.rows.append({
                "action": "absence",
                "trainer_id": band.trainer_id,
                "start": start,
                "end": end,
                "kind": keyword,
                "label": band.text,
            })
            return

        proposed = {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "text": band.text,
            "title": band.title,
            "code": extract_code(band.text),
            "fill_key": band.fill_key,
            "trainer": band.trainer_raw,
        }
        if not band.trainer_id:
            self._review(result, band, ReviewItem.Reason.CODE_UNPARSEABLE, start, end,
                         proposed, proposed)
            return

        code = proposed["code"]
        sessions = Session.objects.filter(
            assignments__trainer_id=band.trainer_id, start_date=start, end_date=end,
        )
        exact = sessions.filter(code_norm=code) if code else sessions
        count = exact.count()
        if code and count == 0 and sessions.exists():
            self._review(result, band, ReviewItem.Reason.DATA_MISMATCH, start, end,
                         {"session_ids": [str(pk) for pk in sessions.values_list("pk", flat=True)]},
                         proposed)
            return
        if count == 0:
            self._review(result, band, ReviewItem.Reason.NOT_IN_DATA, start, end, {}, proposed)
            return
        if count > 1:
            self._review(result, band, ReviewItem.Reason.DATA_MISMATCH, start, end,
                         {"session_ids": [str(pk) for pk in exact.values_list("pk", flat=True)]},
                         proposed)
            return

        session = exact.get()
        if rule is None or (not rule.status and not rule.category):
            self._review(result, band, ReviewItem.Reason.COLOR_UNMAPPED, start, end,
                         {"session_id": str(session.pk)}, proposed)
            return
        if rule.category in (_TITLE, _HOLIDAY):
            self._review(result, band, ReviewItem.Reason.COLOR_UNMAPPED, start, end,
                         {"session_id": str(session.pk)}, proposed)
            return
        status = rule.status if rule.status in SessionStatus.values else ""
        category = rule.category if rule.category in Category.values else ""
        if not status and not category:
            self._review(result, band, ReviewItem.Reason.COLOR_UNMAPPED, start, end,
                         {"session_id": str(session.pk)}, proposed)
            return
        result.rows.append({
            "action": "status",
            "session_id": str(session.pk),
            "status": status,
            "category": category,
            "trainer_id": band.trainer_id,
            "start": start,
            "end": end,
            "text": band.text,
        })

    def _review(self, result, band, reason, start, end, raw, proposed):
        result.rows.append({
            "action": "review",
            "fingerprint": _fingerprint(band, reason, start, end),
            "sheet": band.sheet,
            "cell_range": band.cell,
            "reason": reason,
            "raw": raw,
            "proposed": proposed,
            "trainer_id": band.trainer_id,
            "start": start,
            "end": end,
        })

    @staticmethod
    def _mark_overlaps(result: ParseResult):
        """Deux bandes distinctes, même formateur, jours communs : revue, pas d'écriture de statut."""
        occupied: dict[str, list[dict]] = {}
        for row in result.rows:
            if row["action"] == "review" and row["reason"] == ReviewItem.Reason.CODE_UNPARSEABLE:
                continue
            trainer = row.get("trainer_id")
            start, end = row.get("start"), row.get("end")
            if not trainer or not start or not end:
                continue
            for other in occupied.get(trainer, []):
                if start <= other["end"] and other["start"] <= end and row is not other:
                    for item in (row, other):
                        item["overlapped"] = True
            occupied.setdefault(trainer, []).append(row)
        kept = []
        for row in result.rows:
            if not row.get("overlapped"):
                kept.append(row)
                continue
            if row["action"] != "status":
                kept.append(row)
            token = row.get("text") or row.get("label") or row.get("fingerprint") or row.get("cell_range")
            kept.append({
                "action": "review",
                "fingerprint": hashlib.sha256(
                    f"OVERLAP|{row['trainer_id']}|{row['start']}|{row['end']}|{token}".encode()
                ).hexdigest(),
                "sheet": row.get("sheet", ""),
                "cell_range": row.get("cell_range", ""),
                "reason": ReviewItem.Reason.OVERLAP,
                "raw": {"start": row["start"].isoformat(), "end": row["end"].isoformat()},
                "proposed": {},
                "trainer_id": row["trainer_id"],
                "start": row["start"],
                "end": row["end"],
            })
        result.rows = kept

    def write(self, rows: list[dict], log) -> int:
        written = 0
        reviews_existing = 0
        for row in rows:
            if row["action"] == "absence":
                _, created = Absence.objects.get_or_create(
                    trainer_id=row["trainer_id"], start_date=row["start"], end_date=row["end"],
                    kind=row["kind"],
                    defaults={"label_raw": row["label"], "origin": Origin.GRID},
                )
                written += int(created)
            elif row["action"] == "status":
                session = Session.objects.get(pk=row["session_id"])
                fields = []
                if row["status"] and session.status != row["status"]:
                    session.status = row["status"]
                    fields.append("status")
                if row["category"] and session.category != row["category"]:
                    session.category = row["category"]
                    fields.append("category")
                if fields:
                    session.version += 1
                    session.save(update_fields=[*fields, "version", "updated_at"])
                    written += 1
            elif row["action"] == "review":
                _, created = ReviewItem.objects.get_or_create(
                    fingerprint=row["fingerprint"],
                    defaults={
                        "import_log": log,
                        "sheet": row["sheet"],
                        "cell_range": row["cell_range"],
                        "raw": row["raw"],
                        "proposed": row["proposed"],
                        "reason": row["reason"],
                    },
                )
                written += int(created)
                reviews_existing += int(not created)
        self.report_extra = {
            "absences": sum(r["action"] == "absence" for r in rows),
            "statuses": sum(r["action"] == "status" for r in rows),
            "reviews_existing": reviews_existing,
        }
        return written
