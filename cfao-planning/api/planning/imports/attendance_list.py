"""Import de la « Liste des participants aux formations AAAA » (feuille « Liste stagiaires »).

Une ligne = une personne inscrite à une formation. Le classeur est tenu à la main depuis
2024 : en-têtes qui varient d'une année à l'autre, dates parfois écrites en toutes lettres
(« 16 Juin. 2025 »), heures notées « 8h », lignes de formules restées sans personne.

Données nominatives : aucune valeur de nom, prénom ou pays ne sort dans un rapport
d'import (erreurs, normalisations, doublons). Les lignes refusées citent la colonne et
le code, jamais la personne.

Remplacement : les lignes d'origine IMPORT de l'exercice sont remplacées en bloc par la
version la plus récente du classeur ; les lignes saisies (MANUAL) ne sont jamais touchées.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import re

from core.imports.base import Normalization, ParseResult, RowRejected, SkipRow, TabularImporter
from core.imports.columns import Column, ColumnSpec, normalize_header
from referential.normalize import norm_key
from referential.resolve import Resolver

from ..models import AttendanceOrigin, DeliveryMode, TraineeAttendance
from .data_sheet import parse_date

COLUMNS = ColumnSpec([
    Column("last_name", ("Noms", "Nom", "Nom du stagiaire")),
    Column("first_name", ("Prénoms", "Prénom", "Prenoms", "Prenom"), required=False),
    Column("civility", ("Civilités", "Civillités", "Civilité", "Civilite"), required=False),
    Column("title", ("Désignation formation", "Designation formation", "Intitulé", "Formation")),
    Column("start_date", ("Date début formation", "Date debut formation", "Date de début")),
    Column("end_date", ("Date fin formation", "Date de fin")),
    Column("present", ("Présence à la formation", "Presence a la formation", "Présence")),
    Column("training_number", ("N° de la Formation", "N° formation", "Numéro de la formation"),
           required=False),
    Column("center", ("Centre de Formation",), required=False),
    Column("brand", ("Marques", "Marque"), required=False),
    Column("trainers", ("Animateurs", "Animateur", "Formateurs"), required=False),
    Column("location", ("Lieu de la formation", "Lieu"), required=False),
    Column("hours", ("Nb d'heure de formation", "Nb d'heures de formation",
                     "Durée de la formation (heures)", "Durée de la formation"), required=False),
    Column("country", ("Pays stagiaires", "Pays stagiaire", "Pays"), required=False),
    Column("subsidiary", ("Nom du client interne ou externe", "Filiales", "Filiale"),
           required=False),
    Column("mode", ("Type de formation",), required=False),
])

# Mois écrits à la main, normalisés sans accent ni point : « Juin. » → « juin ».
_MONTHS = {
    "jan": 1, "janv": 1, "janvier": 1,
    "fev": 2, "fevr": 2, "fevrier": 2, "feb": 2,
    "mar": 3, "mars": 3,
    "avr": 4, "avril": 4, "apr": 4,
    "mai": 5, "may": 5,
    "juin": 6, "jun": 6,
    "juil": 7, "juillet": 7, "jul": 7,
    "aou": 8, "aout": 8, "aug": 8,
    "sep": 9, "sept": 9, "septembre": 9,
    "oct": 10, "octobre": 10,
    "nov": 11, "novembre": 11,
    "dec": 12, "decembre": 12,
}
# « 16 Juin. 2025 », « 10 Fév.2025 », « 14 avril ,2025 ».
_TEXT_DATE = re.compile(r"^(\d{1,2})\s*([a-z]+)[\s.,]*(\d{4})$")
_HOURS = re.compile(r"^(\d+(?:[.,]\d+)?)\s*h?$")
_MODES = {"presentiel": DeliveryMode.PRESENTIEL, "distanciel": DeliveryMode.DISTANCIEL,
          "elearning": DeliveryMode.ELEARNING}

# Garde-fou : une nouvelle version qui ferait fondre l'exercice de plus de moitié est
# plus probablement un classeur tronqué qu'une vraie correction.
TRUNCATION_RATIO = 0.5


def _text(value) -> str:
    return "" if value is None else str(value).strip()


def _plain(text: str) -> str:
    return normalize_header(text)  # minuscules, sans accent ni ponctuation


def parse_any_date(column: str, value) -> dt.date:
    if isinstance(value, str):
        import unicodedata

        folded = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
        match = _TEXT_DATE.match(" ".join(folded.lower().split()))
        if match:
            day, month, year = match.groups()
            month_no = _MONTHS.get(month.rstrip("."))
            if month_no:
                try:
                    return dt.date(int(year), month_no, int(day))
                except ValueError:
                    pass
    return parse_date(column, value)


def parse_hours(value) -> int | None:
    """« 8 », 8.0, « 8h » → 8. Une valeur illisible n'empêche pas la ligne : None."""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return int(value) if value >= 0 else None
    match = _HOURS.match(_text(value).lower())
    if not match:
        return None
    return int(float(match.group(1).replace(",", ".")))


def parse_presence(value) -> bool | None:
    text = _plain(_text(value))
    if not text:
        return None
    if text.startswith("present"):
        return True
    if text.startswith("absent"):
        return False
    raise RowRejected("Présence à la formation", _text(value), "INVALID_PRESENCE",
                      "Présence attendue : « Présent », « Absent » ou vide.")


def person_key(last_name: str, first_name: str, country: str) -> str:
    raw = "|".join(norm_key(v) for v in (last_name, first_name, country))
    return hashlib.sha256(raw.encode()).hexdigest()


class AttendanceListImporter(TabularImporter):
    kind = "attendance_list"
    columns = COLUMNS
    natural_key = ("training_key", "start_date", "person_key")

    def __init__(self, year: int):
        self.year = year
        self.resolver = Resolver()

    def _pick_sheet(self, workbook):
        # « Liste stagiaires 2024 » n'est pas toujours la première feuille.
        for name in workbook.sheetnames:
            if _plain(name).startswith("listestagiaires"):
                return workbook[name]
        return workbook.active

    def clean_row(self, line: int, values: dict, result: ParseResult) -> dict:
        last_name = _text(values.get("last_name"))
        if not last_name:
            raise SkipRow  # formules de fin de tableau, sans personne
        number = _text(values.get("training_number"))
        if isinstance(values.get("training_number"), float) and values["training_number"].is_integer():
            number = str(int(values["training_number"]))
        title = _text(values.get("title"))
        if not title and not number:
            if not _text(values.get("center")) and not _text(values.get("present")):
                # Saisie inachevée (2024 : bloc de fin avec seulement dates, nom et filiale) :
                # aucune formation identifiable, la ligne est comptée sans bloquer l'exercice.
                raise SkipRow
            raise RowRejected("Désignation formation", "", "REQUIRED",
                              "Ni intitulé ni N° de formation : la formation est inconnue.")
        start = parse_any_date("Date début formation", values.get("start_date"))
        end = parse_any_date("Date fin formation", values.get("end_date"))
        if end < start:
            # Faute de frappe fréquente dans le classeur : la formation est comptée à sa
            # date de début, et la correction reste visible au rapport.
            result.normalizations.append(Normalization(
                line, "Date fin formation", end.isoformat(), start.isoformat(),
                "fin avant le début : ramenée à la date de début"))
            end = start

        first_name = _text(values.get("first_name"))
        country_raw = _text(values.get("country"))
        country = self.resolver.country(country_raw)
        training_key = number or f"{norm_key(title)}|{start.isoformat()}"

        return {
            "year": self.year,
            "training_key": training_key[:300],
            "training_number": number[:32],
            "center": _text(values.get("center"))[:48],
            "brand_raw": _text(values.get("brand"))[:96],
            "title": title[:255],
            "trainers_raw": _text(values.get("trainers"))[:255],
            "location": _text(values.get("location"))[:96],
            "start_date": start,
            "end_date": end,
            "hours": parse_hours(values.get("hours")),
            "delivery_mode": _MODES.get(_plain(_text(values.get("mode"))), ""),
            "civility": _text(values.get("civility"))[:16],
            "last_name": last_name[:128],
            "first_name": first_name[:128],
            "country_raw": country_raw[:96],
            "country_id": country.obj.pk if country else None,
            "subsidiary": _text(values.get("subsidiary"))[:128],
            "present": parse_presence(values.get("present")),
            "person_key": person_key(last_name, first_name, country_raw),
        }

    def merge_duplicate(self, kept: dict, row: dict, line: int, result: ParseResult) -> bool:
        """Une même personne saisie deux fois pour la même formation : une seule
        participation, présente si l'une des deux lignes le dit. Compté sans le nom."""
        both = (kept["present"], row["present"])
        kept["present"] = True if True in both else (False if False in both else None)
        result.extra["duplicates_merged"] = result.extra.get("duplicates_merged", 0) + 1
        return True

    def parse(self, stream) -> ParseResult:
        result = super().parse(stream)
        if result.fatal or not result.rows:
            if not result.fatal and not result.errors:
                result.fatal = "Aucun stagiaire lu dans la feuille « Liste stagiaires »."
            return result
        existing = TraineeAttendance.objects.filter(
            year=self.year, origin=AttendanceOrigin.IMPORT
        ).count()
        if existing and len(result.rows) < existing * TRUNCATION_RATIO:
            result.fatal = (
                f"Classeur probablement tronqué : {len(result.rows)} stagiaires lus contre "
                f"{existing} en base pour {self.year}. Rien n'est remplacé."
            )
        return result

    def write(self, rows: list[dict], log) -> int:
        removed, _ = TraineeAttendance.objects.filter(
            year=self.year, origin=AttendanceOrigin.IMPORT
        ).delete()
        TraineeAttendance.objects.bulk_create(
            [TraineeAttendance(**row, origin=AttendanceOrigin.IMPORT, last_import=log)
             for row in rows],
            batch_size=500,
        )
        self.report_extra = {"replaced": removed, "created": len(rows)}
        return len(rows)
