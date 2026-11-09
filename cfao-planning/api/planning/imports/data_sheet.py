"""Import A — feuille « Data » du classeur planning : une ligne = une session.

C'est la source maîtresse (SPEC §4) : elle crée et met à jour les sessions. Une
session présente en base mais absente du fichier n'est jamais supprimée ; elle
est listée au rapport (`missing_from_file`) pour décision humaine.
"""
from __future__ import annotations

import datetime as dt
import re

from core.imports.base import ParseResult, RowRejected, TabularImporter
from core.imports.columns import Column, ColumnSpec
from referential.normalize import norm_code, norm_key
from referential.resolve import Resolver

from ..models import Origin, Session, SessionAssignment, TrainingType

COLUMNS = ColumnSpec(
    [
        Column("brand", ("Marque", "Brand"), required=False,
               help_text="Vide pour une formation transverse (process, soft skills)."),
        Column("training_type", ("Type", "Type de formation", "Training type"),
               allowed=("TECHNIQUE", "PROCESS SAV", "PIECES")),
        Column("code", ("Code", "Code module", "Module code")),
        Column("reference", ("Référence", "Reference", "Réf"), required=False),
        Column("title", ("Module de formation", "Module", "Intitulé", "Training module")),
        Column("country", ("Pays hôte", "Pays hote", "Pays", "Host country", "Country")),
        Column("location", ("Lieu", "Location", "Site"), required=False),
        Column("start_date", ("Début", "Debut", "Date début", "Start", "Start date")),
        Column("end_date", ("Fin", "Date fin", "End", "End date")),
        Column("trainers", ("Formateur", "Formateurs", "Animateur", "Trainer", "Trainers"),
               required=False, help_text="Plusieurs noms séparés par « / », « & », « + » ou « , »."),
        Column("days", ("Nbre jour formation", "Nb jours", "Jours", "Days"), required=False),
        Column("hours_per_session", ("Nb heure par session", "Heures par session",
                                     "Hours per session"), required=False),
        Column("seats", ("Nb place par session", "Places", "Seats"), required=False),
        Column("total_hours", ("Nb heure de formation", "Heures de formation", "Total hours"),
               required=False),
    ]
)

_TYPES = {
    "TECHNIQUE": TrainingType.TECHNIQUE,
    "PROCESS SAV": TrainingType.PROCESS_SAV,
    "PROCESS": TrainingType.PROCESS_SAV,
    "PIECES": TrainingType.PIECES,
    "PIECE": TrainingType.PIECES,
}
_TRAINER_SPLIT = re.compile(r"\s*[/&+,]\s*")


def _text(value) -> str:
    return "" if value is None else str(value).strip()


def parse_date(column: str, value) -> dt.date:
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    text = _text(value)
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return dt.datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise RowRejected(column, value, "INVALID_DATE",
                      "Date illisible : attendu JJ/MM/AAAA ou une cellule au format date.")


def parse_int(column: str, value) -> int | None:
    text = _text(value)
    if not text:
        return None
    try:
        number = float(text.replace(",", "."))
    except ValueError:
        raise RowRejected(column, value, "INVALID_NUMBER", "Nombre attendu.") from None
    if number < 0 or number != int(number):
        raise RowRejected(column, value, "INVALID_NUMBER", "Nombre entier positif attendu.")
    return int(number)


class DataSheetImporter(TabularImporter):
    kind = "sessions"
    sheet = "Data"
    columns = COLUMNS
    natural_key = ("year", "brand_id", "code_norm", "start_date", "country_id")

    def __init__(self):
        self.resolver = Resolver()

    # ── validation ──────────────────────────────────────────────────────────
    def _resolve(self, kind: str, column: str, raw, line: int, result: ParseResult):
        match = getattr(self.resolver, kind)(raw)
        if match is None:
            hints = self.resolver.suggest(kind, raw)
            hint = f" Vouliez-vous dire : {', '.join(hints)} ?" if hints else ""
            raise RowRejected(column, raw, f"UNKNOWN_{kind.upper()}",
                              f"Valeur inconnue du référentiel.{hint}")
        if match.rule == "alias":
            result.normalizations.append(
                self._norm(line, column, raw, str(match.obj), "alias")
            )
        return match.obj

    @staticmethod
    def _norm(line, column, from_value, to_value, rule):
        from core.imports.base import Normalization

        return Normalization(line, column, from_value, to_value, rule)

    def clean_row(self, line: int, values: dict, result: ParseResult) -> dict:
        brand = None
        if _text(values.get("brand")):
            brand = self._resolve("brand", "Marque", values["brand"], line, result)

        type_raw = values.get("training_type")
        training_type = _TYPES.get(norm_key(type_raw))
        if training_type is None:
            raise RowRejected("Type", type_raw, "INVALID_CHOICE",
                              "Valeurs acceptées : TECHNIQUE, PROCESS SAV, PIECES.")

        code_raw = _text(values.get("code"))
        code_norm = norm_code(code_raw)
        if not code_norm:
            raise RowRejected("Code", code_raw, "REQUIRED", "Code module obligatoire.")
        if code_norm != code_raw:
            result.normalizations.append(self._norm(line, "Code", code_raw, code_norm, "code"))

        title = _text(values.get("title"))
        if not title:
            raise RowRejected("Module de formation", title, "REQUIRED",
                              "Intitulé du module obligatoire.")

        country = self._resolve("country", "Pays hôte", values.get("country"), line, result)
        start = parse_date("Début", values.get("start_date"))
        end = parse_date("Fin", values.get("end_date"))
        if end < start:
            raise RowRejected("Fin", values.get("end_date"), "END_BEFORE_START",
                              "La date de fin précède la date de début.")

        trainers = []
        for name in _TRAINER_SPLIT.split(_text(values.get("trainers"))):
            if name:
                trainer = self._resolve("trainer", "Formateur", name, line, result)
                if trainer not in trainers:
                    trainers.append(trainer)

        days = parse_int("Nbre jour formation", values.get("days"))
        calendar_days = (end - start).days + 1
        if days is None:
            days = calendar_days
        elif days == 0 or days > calendar_days:
            raise RowRejected("Nbre jour formation", values.get("days"), "INVALID_DAYS",
                              f"Entre 1 et {calendar_days} jours pour ces dates.")

        return {
            "year": start.year,
            "brand_id": brand.pk if brand else None,
            "training_type": training_type,
            "code_norm": code_norm,
            "code_raw": code_raw,
            "reference": _text(values.get("reference")),
            "title": title,
            "country_id": country.pk,
            "location": _text(values.get("location")),
            "start_date": start,
            "end_date": end,
            "days": days,
            "hours_per_session": parse_int("Nb heure par session", values.get("hours_per_session")),
            "seats": parse_int("Nb place par session", values.get("seats")),
            "total_hours": parse_int("Nb heure de formation", values.get("total_hours")),
            "trainer_ids": [t.pk for t in trainers],
        }

    def merge_duplicate(self, kept: dict, row: dict, line: int, result: ParseResult) -> bool:
        """Le classeur écrit une co-animation sur deux lignes identiques, une par
        formateur. Fusion seulement si tout le reste est égal ; sinon doublon."""
        if any(kept[k] != row[k] for k in row if k != "trainer_ids"):
            return False
        added = [t for t in row["trainer_ids"] if t not in kept["trainer_ids"]]
        kept["trainer_ids"].extend(added)
        result.normalizations.append(
            self._norm(line, "Formateur", f"{len(added)} formateur(s) sur une ligne séparée",
                       "co-animation", "merge_duplicate")
        )
        return True

    # ── écriture ────────────────────────────────────────────────────────────
    def write(self, rows: list[dict], log) -> int:
        created = updated = 0
        seen: set = set()
        years = {row["year"] for row in rows}
        for row in rows:
            row = dict(row)
            trainer_ids = row.pop("trainer_ids")
            key = {k: row.pop(k) for k in self.natural_key}
            session = Session.objects.filter(**key).first()
            if session is None:
                session = Session(**key, **row, origin=Origin.DATA, last_import=log,
                                  created_by=log.actor)
                session.save()
                created += 1
            else:
                changed = [f for f, v in row.items() if getattr(session, f) != v]
                for field in changed:
                    setattr(session, field, row[field])
                session.last_import = log
                if changed:
                    session.version += 1
                    updated += 1
                session.save()
            self._sync_trainers(session, trainer_ids)
            seen.add(session.pk)

        missing = (
            Session.objects.filter(year__in=years, origin=Origin.DATA)
            .exclude(pk__in=seen)
            .select_related("country")
        )
        self.report_extra["created"] = created
        self.report_extra["updated"] = updated
        self.report_extra["missing_from_file"] = [
            {"id": str(s.pk), "code": s.code_norm, "start_date": s.start_date.isoformat(),
             "country": s.country.code}
            for s in missing
        ]
        return len(rows)

    @staticmethod
    def _sync_trainers(session: Session, trainer_ids: list) -> None:
        wanted = {tid: (SessionAssignment.Role.LEAD if i == 0 else SessionAssignment.Role.CO)
                  for i, tid in enumerate(trainer_ids)}
        current = {a.trainer_id: a for a in session.assignments.all()}
        for tid, assignment in current.items():
            if tid not in wanted:
                assignment.delete()
            elif assignment.role != wanted[tid]:
                assignment.role = wanted[tid]
                assignment.save(update_fields=["role", "updated_at"])
        for tid, role in wanted.items():
            if tid not in current:
                SessionAssignment.objects.create(session=session, trainer_id=tid, role=role)
