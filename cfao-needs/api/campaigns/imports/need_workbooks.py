"""Fiches d'identification des besoins : classeurs reçus des filiales → base.

Chaque ligne de fiche demandée devient un besoin, module par module et trimestre
par trimestre. Un module absent du catalogue y est ajouté, sans toucher aux lignes
existantes. Rejouer l'import ne change rien, et un besoin déjà en base qui diffère
de la fiche n'est jamais écrasé : il est signalé.
"""
from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from openpyxl import load_workbook

from campaigns.imports.catalog import CatalogImporter
from campaigns.models import CatalogLine, NeedLine, Place, Submission, SubmissionEvent
from campaigns.services.summary import refresh_total
from core.imports.base import ParseResult
from referential.models import OrgUnitRef

ACTOR = "import_need_workbooks"

# Mots du nom de fichier (sans accent, en minuscules) → filiale. Le premier qui
# correspond l'emporte : les noms composés passent avant leur mot seul.
ORG_BY_FILE = (
    # Guinée équatoriale : les fiches portent le sigle de la filiale (« ... v1 RGE.xlsx »).
    ("rge", "groupe.gnq"), ("guinee equatoriale", "groupe.gnq"),
    ("rdc", "groupe.cod"), ("rd congo", "groupe.cod"),
    ("rci", "groupe.civ"), ("congo", "groupe.cog"), ("gabon", "groupe.gab"),
    ("madagascar", "groupe.mdg"), ("maroc", "groupe.mar"), ("tchad", "groupe.tcd"),
    ("togo", "groupe.tgo"), ("cameroun", "groupe.cmr"), ("ghana", "groupe.gha"),
    ("burkina", "groupe.bfa"), ("mali", "groupe.mli"), ("benin", "groupe.ben"),
    ("guinee", "groupe.gin"),
)

FAMILY_BY_SHEET = {
    ("MOBILITY", "TECHNIQUE"): "techniques-motors",
    ("MOBILITY", "PROCESS SAV"): "process-sav-motors",
    ("MOBILITY", "PIECES"): "process-parts-motors",
    ("MOBILITY", "CARROSSERIE"): "techniques-carrosserie",
    ("EQUIPMENT", "EQUIPMENT"): "techniques-equipment",
    ("EQUIPMENT", "PROCESS SAV"): "process-sav-equipment",
    ("EQUIPMENT", "PART"): "process-parts-equipment",
    ("EQUIPMENT", "CARROSSERIE"): "techniques-carrosserie",
    ("EQUIPMENT", "CONDUITE"): "conduite-equipment",
}

# La fiche RCI tient sur une seule feuille : le type de la ligne donne la famille.
RCI_SHEET_BY_TYPE = {"TECHNIQUE": "TECHNIQUE", "SAV": "PROCESS SAV", "PART": "PIECES"}

PLACE_BY_LABEL = {
    "ACADEMY": Place.CFR, "CENTRE DE FORMATION": Place.CFR,
    "FILIALE": Place.FILIALE, "SUBSIDIARY": Place.FILIALE,
    "DISTANCIEL": Place.DISTANCE,
}

# Marques déformées par la traduction automatique des classeurs.
BRAND_FIXES = {"TOYIE": "TOYOTA FORKLIFT", "TOYOTA INDUSTRIES EQUIPMENT": "TOYOTA FORKLIFT"}

NO_PLACE_COMMENT = "Lieu non renseigné sur la fiche."
POSTPONED_COMMENT = "Reporté sur la fiche : {places} place(s)."
# Une case sans couleur est un besoin exprimé que la fiche n'attribue à aucune session,
# même si un lieu est écrit. Les cases vertes (filiale), bleues (Douala) et rouges (reporté)
# sont attribuées.
UNASSIGNED_COMMENT = "Non attribué sur la fiche : {places} place(s)."
# Notes de compteur déjà écrites : remplacées à chaque relecture de la fiche.
SHEET_NOTE = re.compile(r"(Reporté|Non attribué) sur la fiche : \d+ place\(s\)\.")

# Couleur des cases d'effectif ; les classeurs n'ont pas de légende, le sens vient du centre.
IN_SUBSIDIARY, AT_ACADEMY, POSTPONED = "FF92D050", "FF00B0F0", "FFFF0000"
MARKS = (IN_SUBSIDIARY, AT_ACADEMY, POSTPONED)
PLACE_BY_MARK = {IN_SUBSIDIARY: "FILIALE", AT_ACADEMY: "ACADEMY"}


def _ascii_upper(value) -> str:
    raw = unicodedata.normalize("NFKD", str(value or ""))
    return " ".join(raw.encode("ascii", "ignore").decode().upper().split())


def canonical_code(code: str, title: str = "") -> str:
    """Rend le code du catalogue quand la fiche l'a traduit ou réutilisé."""
    code = " ".join(str(code).split())
    code = re.sub(r"-ARGENT$", "-SILVER", code, flags=re.I)
    code = re.sub(r"-OR$", "-GOLD", code, flags=re.I)
    if _ascii_upper(code) == "PARTIE 01":
        return "PART01"
    # Les formulaires donnent FO03 à deux modules ; le second est FO04 au catalogue.
    if code.upper() == "FO03" and _ascii_upper(title).startswith("SUIVI"):
        return "FO04"
    return code


def canonical_brand(label: str) -> str:
    """Libellé accepté par l'import du catalogue, vide pour une ligne transverse."""
    key = _ascii_upper(label)
    if re.match(r"TOUTES (LES )?MARQUES", key):
        return ""
    return BRAND_FIXES.get(key, " ".join(str(label or "").split()))


def _quantity(value) -> int:
    """Effectif d'une case ; « Fait en local » et le vide ne comptent pas."""
    try:
        return int(float(str(value or "0").strip().replace(",", ".")))
    except ValueError:
        return 0


@dataclass(frozen=True)
class SheetRow:
    org: str
    family: str
    brand: str
    code: str
    title: str
    level: str
    quantities: tuple
    places: tuple
    source: str
    marks: tuple = ("", "", "", "")

    def place_of(self, quarter: int) -> str:
        """Lieu d'un trimestre : celui écrit, sinon le seul écrit sur la ligne, sinon la couleur."""
        if self.places[quarter] in PLACE_BY_LABEL:
            return self.places[quarter]
        written = {place for place in self.places if place in PLACE_BY_LABEL}
        if len(written) == 1:
            return written.pop()
        return PLACE_BY_MARK.get(self.marks[quarter], "")


def _org_of(name: str) -> str | None:
    """Filiale d'un fichier, par mots entiers : « Mali » ne se lit pas dans « normalisé »."""
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    words = re.findall(r"[a-z]+", plain)
    text = f" {' '.join(words)} "
    return next((org for key, org in ORG_BY_FILE if f" {key} " in text), None)


def _mark(cell) -> str:
    color = cell.fill.fgColor
    if cell.fill.patternType and color.type == "rgb" and color.rgb in MARKS:
        return color.rgb
    return ""


def _rci_quantities(row, quantities):
    """Sans effectif sur un trimestre, la colonne Total et les noms le donnent."""
    missing = _quantity(row[14]) - sum(quantities)
    named = [i for i in range(4) if row[6 + i] and not quantities[i]]
    if missing > 0 and len(named) == 1:
        quantities[named[0]] = missing
    return quantities


def parse_workbook(path: Path) -> list[SheetRow]:
    """Lignes demandées d'un classeur, quelle que soit la disposition de la feuille."""
    org = _org_of(path.name)
    if org is None:
        return []
    is_rci = org == "groupe.civ"
    pole = _pole_of(path.name)
    book = load_workbook(path, data_only=True)
    result: list[SheetRow] = []
    for sheet in book.worksheets:
        if _ascii_upper(sheet.title) == "LISTE STAGIAIRE":
            continue
        rows = [list(r) + [None] * 20 for r in sheet.iter_rows(values_only=True)]
        header = next((i for i, r in enumerate(rows) if any(str(c or "").strip() == "Page" for c in r)), None)
        if header is None:
            continue
        page = next(i for i, c in enumerate(rows[header]) if str(c or "").strip() == "Page")
        code_col = page - 4 if is_rci else page - 3
        qty_col, place_col = (10, 15) if is_rci else (page + 1, page + 5)
        last_brand = ""
        for number, row in enumerate(rows[header + 2:], start=header + 3):
            raw_code = row[code_col]
            if not str(raw_code or "").strip():
                continue
            brand = "TOYOTA" if is_rci else (str(row[page - 4] or "").strip() or last_brand)
            last_brand = brand
            quantities = [_quantity(row[qty_col + i]) for i in range(4)]
            if is_rci:
                quantities = _rci_quantities(row, quantities)
            if not sum(quantities):
                continue
            kind = _ascii_upper(sheet.title)
            if is_rci:
                kind = RCI_SHEET_BY_TYPE[_ascii_upper(row[page - 2])]
            title = " ".join(str(row[page - 1] or "").split())
            marks = [_mark(sheet.cell(number, qty_col + i + 1)) for i in range(4)]
            if is_rci:  # effectif repris du Total : la couleur est sur le Total
                marks = [mark or _mark(sheet.cell(number, 15)) for mark in marks]
            result.append(SheetRow(
                org=org, family=FAMILY_BY_SHEET[(pole, kind)], brand=canonical_brand(brand),
                code=canonical_code(raw_code, title), title=title,
                level=str(row[0] or "").strip() if page >= 5 else "",
                quantities=tuple(quantities),
                places=tuple(_ascii_upper(row[place_col + i]) for i in range(4)),
                source=path.name, marks=tuple(marks),
            ))
    return result


def _pole_of(name: str) -> str:
    return "EQUIPMENT" if "EQUIPMENT" in name.upper() else "MOBILITY"


def _workbooks(directory: Path) -> list[Path]:
    """Fiches du dossier et de ses sous-dossiers (« Mobility 2027 », « Equipment 2027 »).

    Les formulaires vierges, les trames et le classeur de suivi ne sont pas des fiches.
    """
    root = Path(directory)
    return [
        p for p in sorted(root.rglob("*.xlsx"))
        if not p.name.startswith(("~$", "Trame", "Suivi"))
        and not any("VIERGE" in _ascii_upper(part) for part in p.relative_to(root).parts[:-1])
    ]


def validated_pairs(suivi: Path) -> set[tuple[str, str]]:
    """(filiale, pôle) dont la fiche est validée dans le classeur de suivi, feuille RDV.

    Validée = case RDV verte, rapport du RDV et calendrier reçus (« Yes »). Les colonnes
    se repèrent par leur libellé : le centre peut en insérer ou les déplacer.
    """
    try:
        sheet = load_workbook(suivi, data_only=True)["RDV"]
    except (FileNotFoundError, KeyError) as exc:
        raise ValueError(f"Feuille RDV introuvable dans {suivi}") from exc
    rows = sheet.iter_rows()
    labels = [_ascii_upper(c.value) for c in next(rows, ())]
    wanted = ("PAYS", "POLE", "RDV", "RAPPORT RDV", "CALENDRIER")
    if any(label not in labels for label in wanted):
        raise ValueError(f"Colonnes attendues dans la feuille RDV : {', '.join(wanted)}")
    country, pole, rdv, report, calendar = (labels.index(label) for label in wanted)
    pairs = set()
    for row in rows:
        org = _org_of(str(row[country].value or ""))
        done = all(_ascii_upper(row[i].value) == "YES" for i in (report, calendar))
        if org and done and _mark(row[rdv]) == IN_SUBSIDIARY:
            pairs.add((org, _pole_of(str(row[pole].value or ""))))
    return pairs


def is_validated(path: Path, pairs: set[tuple[str, str]] | None) -> bool:
    return pairs is None or (_org_of(path.name), _pole_of(path.name)) in pairs


def parse_directory(directory: Path, pairs: set[tuple[str, str]] | None = None) -> list[SheetRow]:
    """Lignes des fiches ; avec `pairs`, seulement celles des fiches validées."""
    rows: list[SheetRow] = []
    for path in _workbooks(directory):
        if is_validated(path, pairs):
            rows.extend(parse_workbook(path))
    return rows


def unknown_files(directory: Path) -> list[str]:
    """Classeurs écartés faute de filiale reconnue : à signaler, jamais en silence."""
    return [p.name for p in _workbooks(directory) if _org_of(p.name) is None]


def pending_files(directory: Path, pairs: set[tuple[str, str]]) -> list[str]:
    """Fiches d'une filiale reconnue mais pas encore validées : écartées, et signalées."""
    return [p.name for p in _workbooks(directory) if _org_of(p.name) and not is_validated(p, pairs)]


@dataclass
class Report:
    catalog_added: list = field(default_factory=list)
    submissions_created: list = field(default_factory=list)
    lines_added: dict = field(default_factory=lambda: defaultdict(int))
    places_added: dict = field(default_factory=lambda: defaultdict(int))
    unchanged: int = 0
    conflicts: list = field(default_factory=list)
    split: list = field(default_factory=list)
    ambiguous: list = field(default_factory=list)
    place_conflicts: list = field(default_factory=list)
    lines_precised: int = 0

    @property
    def total_places_added(self) -> int:
        return sum(self.places_added.values())


class _Catalog:
    """Lignes du catalogue de la campagne ; complète celles qui manquent."""

    def __init__(self, campaign, report: Report):
        self.campaign, self.report = campaign, report
        self.importer = CatalogImporter(campaign, replace=False)
        self.lines = defaultdict(list)
        for line in campaign.catalog_lines.select_related("family", "brand"):
            self.lines[(line.family.key, line.code.upper())].append(line)

    def _clean(self, row: SheetRow) -> dict:
        return self.importer.clean_row(0, {
            "family": row.family, "brand": row.brand, "code": row.code,
            "title": row.title, "audience": row.level,
        }, ParseResult(kind=self.importer.kind))

    def line_for(self, row: SheetRow) -> CatalogLine | None:
        candidates = self.lines[(row.family, row.code.upper())]
        if len(candidates) == 1:
            return candidates[0]
        clean = self._clean(row)
        if candidates:
            same = [c for c in candidates if c.brand_id == (clean["brand"].pk if clean["brand"] else None)]
            if len(same) == 1:
                return same[0]
            if not clean["brand"]:
                self.report.ambiguous.append((row.source, row.code, row.brand))
                return None
        return self._create(row, clean)

    def _create(self, row: SheetRow, clean: dict) -> CatalogLine:
        last = CatalogLine.objects.filter(
            campaign=self.campaign, family=clean["family"], brand=clean["brand"],
        ).aggregate(m=Max("sort_order"))["m"] or 0
        line = CatalogLine.objects.create(
            campaign=self.campaign, family=clean["family"], brand=clean["brand"],
            code=clean["code"], title=clean["title"], title_en=clean["title_en"],
            level_label=clean["level_label"], tier=clean["tier"],
            populations=clean["populations"], sort_order=last + 10,
        )
        self.lines[(row.family, row.code.upper())].append(line)
        self.report.catalog_added.append((row.family, row.brand, row.code))
        return line


def _merge(rows: list[SheetRow], catalog: _Catalog) -> dict:
    """Besoins voulus par (filiale, ligne de catalogue), fiches additionnées."""
    wanted: dict = {}
    for row in rows:
        line = catalog.line_for(row)
        if line is None:
            continue
        entry = wanted.setdefault((row.org, line.pk), {"line": line, "q": [0] * 4, "places": [""] * 4, "postponed": 0,
                                                     "unassigned": 0})
        for i in range(4):
            entry["q"][i] += row.quantities[i]
            entry["places"][i] = entry["places"][i] or (row.place_of(i) if row.quantities[i] else "")
            entry["postponed"] += row.quantities[i] if row.marks[i] == POSTPONED else 0
            entry["unassigned"] += row.quantities[i] if not row.marks[i] else 0
    return wanted


def _need_fields(entry: dict) -> dict:
    fields = {f"q{i + 1}": entry["q"][i] for i in range(4)}
    for i in range(4):
        fields[f"place_q{i + 1}"] = PLACE_BY_LABEL.get(entry["places"][i], Place.CFR)
    no_place = any(entry["q"][i] and entry["places"][i] not in PLACE_BY_LABEL for i in range(4))
    notes = [NO_PLACE_COMMENT if no_place else "", _postponed_note(entry), _unassigned_note(entry)]
    fields["comment"] = " ".join(note for note in notes if note)
    fields["postponed"] = entry["postponed"]
    fields["unassigned"] = entry["unassigned"]
    return fields


def _postponed_note(entry: dict) -> str:
    return POSTPONED_COMMENT.format(places=entry["postponed"]) if entry["postponed"] else ""


def _unassigned_note(entry: dict) -> str:
    return UNASSIGNED_COMMENT.format(places=entry["unassigned"]) if entry.get("unassigned") else ""


def _precise_line(need, entry, report: Report) -> bool:
    """Reporte sur un besoin déjà saisi le lieu et le report de la fiche.

    Seul le lieu par défaut est remplacé : un lieu choisi autrement est signalé.
    """
    changes = {}
    for i in range(4):
        wanted = PLACE_BY_LABEL.get(entry["places"][i])
        have = getattr(need, f"place_q{i + 1}")
        if not entry["q"][i] or wanted in (None, have):
            continue
        if have == Place.CFR:
            changes[f"place_q{i + 1}"] = wanted
        else:
            report.place_conflicts.append((need.submission.org_unit.code, entry["line"].code, i + 1, have, wanted))
    known = all(entry["places"][i] in PLACE_BY_LABEL for i in range(4) if entry["q"][i])
    comment = "" if need.comment == NO_PLACE_COMMENT and known else need.comment
    comment = " ".join(SHEET_NOTE.sub("", comment).split())
    for note in (_postponed_note(entry), _unassigned_note(entry)):
        if note and note not in comment:
            comment = f"{comment} {note}".strip()
    if comment != need.comment:
        changes["comment"] = comment
    # Les compteurs ne viennent que des couleurs de la fiche : la fiche relue fait foi
    # (une case bleue, autrefois lue sans couleur, quitte ainsi les places non attribuées).
    for field in ("postponed", "unassigned"):
        if entry.get(field, 0) != getattr(need, field):
            changes[field] = entry.get(field, 0)
    if changes:
        NeedLine.objects.filter(pk=need.pk).update(**changes)
    return bool(changes)


def _submission(campaign, org_code: str, report: Report) -> Submission:
    org = OrgUnitRef.objects.get(code=org_code)
    submission, created = Submission.objects.get_or_create(
        campaign=campaign, org_unit=org,
        defaults={"country": org.country, "status": Submission.Status.VALIDATED, "validated_at": timezone.now()},
    )
    if created:
        report.submissions_created.append(org_code)
        SubmissionEvent.objects.create(submission=submission, actor=ACTOR, kind=SubmissionEvent.Kind.VALIDATED,
                                       payload={"source": "fiche classeur"})
    return submission


def _split_reused_code(need, entry, entries) -> int:
    """Rend à FO03 sa part quand la base a fusionné FO03 et FO04, sous le même code.

    Renvoie les places passées sur FO04, 0 si le besoin n'est pas dans ce cas.
    """
    twin = next((e for e in entries if e["line"].code == "FO04" and e["line"].family_id == entry["line"].family_id), None)
    have = [need.q1, need.q2, need.q3, need.q4]
    if entry["line"].code != "FO03" or twin is None or have != [a + b for a, b in zip(entry["q"], twin["q"])]:
        return 0
    NeedLine.objects.filter(pk=need.pk).update(**{f"q{i + 1}": entry["q"][i] for i in range(4)})
    return sum(twin["q"])


@transaction.atomic
def apply_rows(campaign, rows: list[SheetRow]) -> Report:
    report = Report()
    wanted = _merge(rows, _Catalog(campaign, report))
    by_org = defaultdict(list)
    for (org, _), entry in wanted.items():
        by_org[org].append(entry)
    for org, entries in by_org.items():
        submission = _submission(campaign, org, report)
        existing = {n.catalog_line_id: n for n in submission.lines.all()}
        added = moved = precised = 0
        for entry in entries:
            need = existing.get(entry["line"].pk)
            if need is None:
                NeedLine.objects.create(submission=submission, catalog_line=entry["line"], **_need_fields(entry))
                report.lines_added[org] += 1
                added += sum(entry["q"])
            elif [need.q1, need.q2, need.q3, need.q4] == entry["q"]:
                if _precise_line(need, entry, report):
                    precised += 1
                else:
                    report.unchanged += 1
            elif split := _split_reused_code(need, entry, entries):
                moved += split
                report.split.append((org, entry["line"].code, split))
            else:
                report.conflicts.append((org, entry["line"].code, [need.q1, need.q2, need.q3, need.q4], entry["q"]))
        added -= moved
        report.lines_precised += precised
        if added or moved or precised:
            report.places_added[org] = added
            SubmissionEvent.objects.create(
                submission=submission, actor=ACTOR, kind=SubmissionEvent.Kind.CORRECTED,
                payload={"source": "fiche classeur", "lines_added": report.lines_added[org], "places_added": added,
                         "places_moved": moved, "lines_precised": precised},
            )
            refresh_total(submission)
    return report
