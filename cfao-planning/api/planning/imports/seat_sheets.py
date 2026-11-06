"""Import du prévisionnel — feuilles pays du classeur « Clé de Répartition » (SPEC §8).

Une feuille par pays bénéficiaire liste les sessions où ce pays a des places. Ces
lignes sont du prévisionnel : elles alimentent `PlannedSession` et
`PlannedAllocation`, jamais `Session`. Une session prévue a pour identité (clé de
l'année, marque, code, date de début, pays hôte) ; le pays hôte se déduit du lieu,
ou de la feuille quand le lieu est vide. La même session revient sur la feuille de
chaque pays qui y a des places : ces copies doivent concorder.

Une clé gelée n'accepte qu'un fichier identique à son prévu (no-op) ; tout écart
rejette l'import sans écriture, diff à l'appui.

Les feuilles qui ne nomment pas un pays du référentiel (synthèse, feuilles par
marque, journal des macros) sont ignorées et listées au rapport.
"""
from __future__ import annotations

import re
from typing import BinaryIO

from django.conf import settings

from core.imports.base import ParseResult, RowError, RowRejected, TabularImporter, TooManyRows
from core.imports.columns import Column, ColumnSpec, MissingColumns
from referential.models import Country
from referential.normalize import norm_code, norm_key
from referential.resolve import Resolver

from ..models import CostKeyYear, FrozenKeyError, PlannedAllocation, PlannedSession
from .data_sheet import _TRAINER_SPLIT, parse_date, parse_int

COLUMNS = ColumnSpec(
    [
        Column("brand", ("Marque", "Brand")),
        Column("code", ("Code", "Code module", "Module code")),
        Column("title", ("Formation", "Module de formation", "Intitulé"), required=False),
        Column("start_date", ("Date début", "Début", "Start date")),
        Column("end_date", ("Date fin", "Fin", "End date"), required=False),
        Column("trainers", ("Formateur", "Formateurs", "Trainer"), required=False),
        Column("location", ("Lieu", "Location"), required=False),
        Column("seats", ("Places attribuées", "Places attribués", "Places", "Seats")),
    ]
)

# « Places Attribués 2026 » : l'année du classeur ne fait pas partie du libellé.
_TRAILING_YEAR = re.compile(r"\s*\d{4}\s*$")


def _text(value) -> str:
    return "" if value is None else str(value).strip()


def _hint(hints: list[str]) -> str:
    return f" Vouliez-vous dire : {', '.join(hints)} ?" if hints else ""


def group_rows(rows: list[dict]) -> dict[tuple, dict]:
    """Une entrée par session prévue, avec les places de chaque pays lu."""
    groups: dict[tuple, dict] = {}
    for row in rows:
        group = groups.setdefault(row["identity"], {
            k: row[k] for k in ("code_raw", "title", "end_date", "location", "trainer_ids",
                                "trainers")
        } | {"allocations": {}})
        group["title"] = group["title"] or row["title"]
        group["allocations"][row["country_id"]] = row["seats"]
    return groups


def _state(end_date, location, trainer_ids, allocations: dict) -> tuple:
    return end_date, norm_key(location), frozenset(trainer_ids), frozenset(allocations.items())


def _stored_state(key: CostKeyYear, countries: set) -> dict[tuple, tuple]:
    """Le prévu en base d'une clé, restreint aux pays lus dans le fichier."""
    state = {}
    planned = key.planned_sessions.prefetch_related("trainers", "allocations")
    for p in planned:
        allocations = {a.country_id: a.seats for a in p.allocations.all()
                       if a.country_id in countries}
        if allocations:
            identity = (key.pk, p.brand_id, p.code_norm, p.start_date, p.country_id)
            state[identity] = _state(p.end_date, p.location,
                                     [t.pk for t in p.trainers.all()], allocations)
    return state


def frozen_diff(key: CostKeyYear, groups: dict[tuple, dict], countries: set) -> dict:
    """Écart entre le fichier et le prévu gelé ; vide si le contenu est identique."""
    stored = _stored_state(key, countries)
    wanted = {
        identity: _state(g["end_date"], g["location"], g["trainer_ids"], g["allocations"])
        for identity, g in groups.items() if identity[0] == key.pk
    }

    def label(identity):
        _, _, code, start, _ = identity
        return f"{code} {start:%d/%m/%Y}" if start else code

    diff = {
        "created": sorted(label(i) for i in wanted.keys() - stored.keys()),
        "updated": sorted(label(i) for i in wanted.keys() & stored.keys()
                          if wanted[i] != stored[i]),
        "missing": sorted(label(i) for i in stored.keys() - wanted.keys()),
    }
    return diff if any(diff.values()) else {}


class SeatSheetsImporter(TabularImporter):
    kind = "seat_allocations"
    columns = COLUMNS
    natural_key = ("identity", "country_id")

    def __init__(self):
        self.resolver = Resolver()
        self._keys: dict[tuple, CostKeyYear | None] = {}

    # ── lecture : toutes les feuilles pays du classeur ──────────────────────
    def parse(self, stream: BinaryIO) -> ParseResult:
        from openpyxl import load_workbook

        result = ParseResult(kind=self.kind, extra={"sheets": [], "ignored_sheets": []})
        workbook = load_workbook(stream, read_only=True, data_only=True)
        seen: dict[tuple, tuple[str, int]] = {}
        planned: dict[tuple, dict] = {}
        try:
            for ws in workbook.worksheets:
                match = self.resolver.country(ws.title)
                if match is None:
                    result.extra["ignored_sheets"].append(ws.title)
                    continue
                self._parse_sheet(ws, match.obj, result, seen, planned)
        except TooManyRows as exc:
            result.fatal = str(exc)
        if not result.fatal:
            self._check_frozen(result)
        return result

    def _parse_sheet(self, ws, country, result: ParseResult, seen: dict, planned: dict) -> None:
        rows = ws.iter_rows(values_only=True)
        headers = [_TRAILING_YEAR.sub("", self._text(c)) for c in next(rows, ()) or ()]
        try:
            mapping, unknown = self.columns.resolve(headers)
        except MissingColumns as exc:
            result.fatal = f"Feuille « {ws.title} » : {exc}"
            return
        result.unknown_columns.extend(f"{ws.title} · {h}" for h in unknown)

        summary = {"sheet": ws.title, "country": country.code, "seats": 0, "declared": None}
        # Marque et code ne sont écrits qu'une fois par bloc : on les reporte.
        carry = {"brand": None, "code": None, "title": None}
        errors_before = len(result.errors)
        limit = settings.IMPORT_MAX_ROWS
        for offset, raw in enumerate(rows):
            if offset >= limit:
                raise TooManyRows(f"Feuille « {ws.title} » : plus de {limit} lignes.")
            line = offset + 2
            values = {key: self._cell(raw, idx) for key, idx in mapping.items()}
            if norm_key(values["brand"]).startswith("TOTAL"):
                # Pied de feuille : total des places, puis coûts calculés par formule.
                summary["declared"] = parse_int("Places", values["seats"])
                break
            if not any(_text(v) for v in values.values()):
                continue
            for key in carry:
                if _text(values.get(key)):
                    carry[key] = values[key]
                else:
                    values[key] = carry[key]
            result.rows_read += 1
            try:
                cleaned = self.clean_row(line, values, result, country=country)
            except RowRejected as exc:
                result.errors.append(exc.as_row_error(line, sheet=ws.title))
                continue
            if cleaned is None:
                continue  # créneau sans place pour ce pays
            cleaned.update(sheet=ws.title, line=line, country_id=country.pk,
                           country_code=country.code)
            summary["seats"] += cleaned["seats"]

            identity = cleaned["identity"]
            if (identity, country.pk) in seen:
                first_sheet, first_line = seen[identity, country.pk]
                result.errors.append(RowError(
                    row=line, column="Code / Date début", value=cleaned["code_norm"],
                    code="DUPLICATE_KEY", sheet=ws.title,
                    message=(f"Session déjà attribuée à ce pays feuille « {first_sheet} » "
                             f"ligne {first_line}."),
                ))
                continue
            seen[identity, country.pk] = (ws.title, line)

            # Les copies d'une même session sur plusieurs feuilles doivent concorder.
            facts = (cleaned["end_date"], norm_key(cleaned["location"]),
                     frozenset(cleaned["trainer_ids"]))
            first = planned.setdefault(identity, {"sheet": ws.title, "line": line,
                                                  "facts": facts})
            if first["facts"] != facts:
                result.errors.append(RowError(
                    row=line, column="Date fin / Lieu / Formateur", value=cleaned["code_norm"],
                    code="PLANNED_CONFLICT", sheet=ws.title,
                    message=(f"Même session que feuille « {first['sheet']} » ligne "
                             f"{first['line']}, mais fin, lieu ou formateurs diffèrent."),
                ))
                continue
            result.rows.append(cleaned)

        # Une ligne refusée fausse déjà la somme : le contrôle n'apprendrait rien.
        clean_sheet = len(result.errors) == errors_before
        if clean_sheet and summary["declared"] not in (None, summary["seats"]):
            result.errors.append(RowError(
                row=0, column="TOTAL", value=summary["declared"], code="TOTAL_MISMATCH",
                sheet=ws.title,
                message=f"Total déclaré {summary['declared']}, lignes lues {summary['seats']}.",
            ))
        result.extra["sheets"].append(summary)

    # ── validation d'une ligne ──────────────────────────────────────────────
    def clean_row(self, line: int, values: dict, result: ParseResult,
                  country: Country | None = None) -> dict | None:
        seats = parse_int("Places", values.get("seats"))
        if not seats:
            return None

        brand_match = self.resolver.brand(values.get("brand"))
        if brand_match is None:
            raise RowRejected("Marque", values.get("brand"), "UNKNOWN_BRAND",
                              "Valeur inconnue du référentiel."
                              + _hint(self.resolver.suggest("brand", values.get("brand"))))
        brand = brand_match.obj

        code_raw = _text(values.get("code"))
        code_norm = norm_code(code_raw)
        if not code_norm:
            raise RowRejected("Code", code_raw, "REQUIRED", "Code module obligatoire.")
        start = parse_date("Date début", values.get("start_date"))
        end = parse_date("Date fin", values["end_date"]) if _text(values.get("end_date")) else None
        if end and end < start:
            raise RowRejected("Date fin", end.isoformat(), "END_BEFORE_START",
                              "La fin précède le début.")

        # Le lieu désigne le pays hôte (« Douala » → Cameroun) ; vide, c'est le pays
        # de la feuille ; inconnu, la ligne est refusée.
        location = _text(values.get("location"))
        host = country
        if location:
            host_match = self.resolver.country(location)
            if host_match is None:
                raise RowRejected("Lieu", location, "UNKNOWN_LOCATION",
                                  "Lieu sans pays connu au référentiel."
                                  + _hint(self.resolver.suggest("country", location)))
            host = host_match.obj

        trainers_raw = _text(values.get("trainers"))
        trainer_ids: list = []
        for name in _TRAINER_SPLIT.split(trainers_raw):
            if not name:
                continue
            trainer = self.resolver.trainer(name)
            if trainer is None:
                raise RowRejected("Formateur", name, "UNKNOWN_TRAINER",
                                  "Formateur inconnu du référentiel."
                                  + _hint(self.resolver.suggest("trainer", name)))
            if trainer.obj.pk not in trainer_ids:
                trainer_ids.append(trainer.obj.pk)

        key = self._key(start.year, brand.pole)
        if key is None:
            raise RowRejected("Date début", start.isoformat(), "NO_COST_KEY",
                              f"Aucune clé de répartition {start.year} {brand.pole}.")
        return {
            "identity": (key.pk, brand.pk, code_norm, start, host.pk),
            "code_norm": code_norm,
            "code_raw": code_raw,
            "title": _text(values.get("title")),
            "start_date": start,
            "end_date": end,
            "location": location,
            "trainers": trainers_raw,
            "trainer_ids": trainer_ids,
            "seats": seats,
        }

    def _key(self, year: int, pole: str) -> CostKeyYear | None:
        if (year, pole) not in self._keys:
            self._keys[year, pole] = CostKeyYear.objects.filter(year=year, pole=pole).first()
        return self._keys[year, pole]

    def _check_frozen(self, result: ParseResult) -> None:
        """Clé gelée : contenu identique → no-op ; sinon import rejeté, diff à l'appui."""
        groups = group_rows(result.rows)
        countries = self._read_countries(result)
        noop, diffs = [], {}
        for key in {k for k in self._keys.values() if k is not None and k.is_frozen}:
            diff = frozen_diff(key, groups, countries)
            if diff:
                diffs[str(key)] = diff
            else:
                noop.append(str(key))
        result.extra["frozen_noop"] = sorted(noop)
        if diffs:
            result.extra["frozen_diff"] = diffs
            result.fatal = "KEY_FROZEN"

    @staticmethod
    def _read_countries(result: ParseResult) -> set:
        codes = [s["country"] for s in result.extra.get("sheets", [])]
        return set(Country.objects.filter(code__in=codes).values_list("pk", flat=True))

    # ── écriture ────────────────────────────────────────────────────────────
    def apply(self, result: ParseResult, actor: str = "", file_sha256: str = "",
              params: dict | None = None):
        self._params = params or {}
        self._countries = self._read_countries(result)
        return super().apply(result, actor=actor, file_sha256=file_sha256, params=params)

    def write(self, rows: list[dict], log) -> int:
        groups = group_rows(rows)
        keys = {k.pk: k for k in CostKeyYear.objects.filter(pk__in={i[0] for i in groups})}
        noop = set()
        for key in keys.values():
            if key.is_frozen:
                # Gelée depuis la prévisualisation et contenu différent : on refuse.
                if frozen_diff(key, groups, self._countries):
                    raise FrozenKeyError(f"{key} gelée : prévu non modifiable.")
                noop.add(key.pk)

        created = updated = sessions = written = 0
        for identity, group in groups.items():
            key_id, brand_id, code_norm, start, host_id = identity
            if key_id in noop:
                continue
            fields = {"code_raw": group["code_raw"], "title": group["title"],
                      "end_date": group["end_date"], "location": group["location"],
                      "trainers_raw": group["trainers"]}
            planned, was_created = PlannedSession.objects.get_or_create(
                cost_key_id=key_id, brand_id=brand_id, code_norm=code_norm, start_date=start,
                country_id=host_id, defaults={**fields, "last_import": log},
            )
            sessions += 1
            if not was_created:
                changed = [f for f, v in fields.items() if getattr(planned, f) != v]
                if changed:
                    for f in changed:
                        setattr(planned, f, fields[f])
                    planned.last_import = log
                    planned.save(update_fields=[*changed, "last_import", "updated_at"])
            if {t.pk for t in planned.trainers.all()} != set(group["trainer_ids"]):
                planned.trainers.set(group["trainer_ids"])

            for country_id, seats in group["allocations"].items():
                allocation, was_created = PlannedAllocation.objects.get_or_create(
                    planned_session=planned, country_id=country_id, defaults={"seats": seats},
                )
                if was_created:
                    created += 1
                elif allocation.seats != seats:
                    allocation.seats = seats
                    allocation.save(update_fields=["seats", "updated_at"])
                    updated += 1
                written += 1

        # Absents : seulement sur les clés écrites et les pays lus.
        touched = set(keys) - noop
        kept = {(identity, c) for identity, g in groups.items() for c in g["allocations"]}
        missing = [
            a for a in PlannedAllocation.objects.filter(
                planned_session__cost_key_id__in=touched, country_id__in=self._countries,
            ).select_related("planned_session__country", "country")
            if ((a.planned_session.cost_key_id, a.planned_session.brand_id,
                 a.planned_session.code_norm, a.planned_session.start_date,
                 a.planned_session.country_id), a.country_id) not in kept
        ]
        report_missing = [
            {"session": str(a.planned_session), "country": a.country.code, "seats": a.seats}
            for a in missing
        ]
        if self._params.get("replace") and missing:
            PlannedAllocation.objects.filter(pk__in=[a.pk for a in missing]).delete()
            PlannedSession.objects.filter(cost_key_id__in=touched,
                                          allocations__isnull=True).delete()
        self.report_extra.update(
            created=created, updated=updated, planned_sessions=sessions,
            missing_from_file=report_missing, replaced=bool(self._params.get("replace")),
            frozen_noop=sorted(str(keys[k]) for k in noop),
        )
        return written
