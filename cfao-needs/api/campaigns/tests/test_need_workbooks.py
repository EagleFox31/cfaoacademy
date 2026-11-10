"""Fiches de besoins des filiales : lecture des classeurs."""
import pytest
from openpyxl import Workbook, load_workbook
from openpyxl.styles import PatternFill

from campaigns.imports.need_workbooks import Report, _precise_line, canonical_brand, canonical_code, parse_workbook
from campaigns.models import Campaign, CatalogFamily, CatalogLine, NeedLine, Submission
from referential.models import OrgUnitRef


@pytest.mark.parametrize("raw,title,expected", [
    ("SS03-ARGENT", "", "SS03-SILVER"),
    ("SS09-OR", "", "SS09-GOLD"),
    ("PARTIE 01", "", "PART01"),
    ("FO03", "Suivi des travaux du véhicule", "FO04"),
    ("FO03", "Réception du véhicule", "FO03"),
    ("TS01-G4", "", "TS01-G4"),
])
def test_code_rendu_au_catalogue(raw, title, expected):
    assert canonical_code(raw, title) == expected


@pytest.mark.parametrize("raw,expected", [
    ("TOUTES MARQUES EQUIPMENT", ""),
    ("Toutes les marques VL", ""),
    ("TOYIE", "TOYOTA FORKLIFT"),
    ("SUZUKI", "SUZUKI"),
])
def test_marque_rendue_au_catalogue(raw, expected):
    assert canonical_brand(raw) == expected


def _save(tmp_path, name, title, rows):
    book = Workbook()
    sheet = book.active
    sheet.title = title
    for row in rows:
        sheet.append(row)
    path = tmp_path / name
    book.save(path)
    return path


HEADER = ["NIVEAU", "MARQUE", "CODE", "TYPE", "NOM", "Page", "Effectif", None, None, None, "Lieu"]
QUARTERS = [None] * 6 + ["T1", "T2", "T3", "T4"] * 2


def test_lit_la_ligne_demandee_et_reporte_la_marque_fusionnee(tmp_path):
    path = _save(tmp_path, "MOBILITY 2027_Tchad.xlsx", " TECHNIQUE ", [
        ["Titre"], HEADER, QUARTERS,
        ["SENIOR", "SUZUKI", "SS03-ARGENT", "T", "Diag", 9, 2, None, None, 1, "ACADEMY", None, None, "SUBSIDIARY"],
        ["SENIOR", None, "SS04-ARGENT", "T", "Rép", 10, None, "Fait en local", None, 3],
        ["SENIOR", "SUZUKI", "SS05", "T", "Vide", 11],
    ])
    rows = parse_workbook(path)
    assert [(r.org, r.family, r.brand, r.code, r.quantities) for r in rows] == [
        ("groupe.tcd", "techniques-motors", "SUZUKI", "SS03-SILVER", (2, 0, 0, 1)),
        ("groupe.tcd", "techniques-motors", "SUZUKI", "SS04-SILVER", (0, 0, 0, 3)),
    ]
    assert rows[0].places == ("ACADEMY", "", "", "SUBSIDIARY")


def test_conduite_sans_colonne_niveau(tmp_path):
    path = _save(tmp_path, "Fiche EQUIPMENT 2027_Congo.xlsx", "CONDUITE", [
        ["Titre"], ["MARQUE", "CODE", "TYPE", "NOM", "Page"], [],
        ["TOUTES MARQUES EQUIPMENT", "CAM", "CONDUITE", "Camions", 6, 1, None, None, None, "Filiale"],
    ])
    row = parse_workbook(path)[0]
    assert (row.family, row.brand, row.code, row.level, row.quantities) == ("conduite-equipment", "", "CAM", "", (1, 0, 0, 0))


def test_rci_effectif_absent_repris_du_total(tmp_path):
    line = ["SENIOR", "TS07-G3", "G3", "TECHNIQUE", "Certif", 15] + [None, None, None, "NOMS"]
    line += [None, None, None, None, 4, None, None, None, "SUBSIDIARY"]
    path = _save(tmp_path, "MOBILITY_RCI_Toyota.xlsx", "Liste des formations", [
        ["Titre"], ["NIVEAU", "CODE", None, "TYPE", "NOM", "Page"], [], line,
    ])
    row = parse_workbook(path)[0]
    assert (row.org, row.brand, row.quantities) == ("groupe.civ", "TOYOTA", (0, 0, 0, 4))
    assert row.places[3] == "SUBSIDIARY"


def _paint(path, cells):
    book = load_workbook(path)
    for ref, rgb in cells.items():
        book.active[ref].fill = PatternFill("solid", fgColor=rgb)
    book.save(path)


def test_couleurs_lieu_filiale_et_report(tmp_path):
    path = _save(tmp_path, "MOBILITY 2027_Tchad.xlsx", "TECHNIQUE", [
        ["Titre"], HEADER, QUARTERS,
        ["SENIOR", "TOYOTA", "TS06-G3", "T", "A", 9, None, None, 3],
        ["SENIOR", "TOYOTA", "TS11-G2", "T", "B", 10, None, None, None, 3, None, None, None, "ACADEMY"],
        ["SENIOR", "TOYOTA", "TP03", "T", "C", 11, None, None, 3, None, "ACADEMY"],
        ["SENIOR", "TOYOTA", "TS01", "T", "D", 12, 2],
    ])
    _paint(path, {"I4": "FF92D050", "J5": "FFFF0000", "I6": "FF92D050"})
    green, red, written_elsewhere, plain = parse_workbook(path)
    assert green.place_of(2) == "FILIALE"
    assert red.marks[3] == "FFFF0000" and red.place_of(3) == "ACADEMY"
    assert written_elsewhere.place_of(2) == "ACADEMY"
    assert plain.place_of(0) == ""


def test_rci_couleur_portee_par_le_total(tmp_path):
    line = ["SENIOR", "TS07-G3", "G3", "TECHNIQUE", "Certif", 15] + [None, None, None, "NOMS"]
    line += [None, None, None, None, 4, None, None, None, "SUBSIDIARY"]
    path = _save(tmp_path, "MOBILITY_RCI_Toyota.xlsx", "Liste des formations", [
        ["Titre"], ["NIVEAU", "CODE", None, "TYPE", "NOM", "Page"], [], line,
    ])
    _paint(path, {"O4": "FF92D050"})
    row = parse_workbook(path)[0]
    assert row.marks[3] == "FF92D050" and row.place_of(3) == "SUBSIDIARY"


@pytest.mark.django_db
def test_report_enregistre_une_seule_fois_et_places_gardees():
    campaign = Campaign.objects.create(year=2027, label="2027")
    family = CatalogFamily.objects.create(key="f", label="F", pole="MOBILITY")
    line = CatalogLine.objects.create(campaign=campaign, family=family, code="TS11-G2", title="T")
    unit = OrgUnitRef.objects.create(code="ou-cg", label="Congo")
    submission = Submission.objects.create(campaign=campaign, org_unit=unit, country="CONGO",
                                           status=Submission.Status.VALIDATED)
    need = NeedLine.objects.create(submission=submission, catalog_line=line, q4=3)
    entry = {"line": line, "q": [0, 0, 0, 3], "places": ["", "", "", "ACADEMY"], "postponed": 3}

    assert _precise_line(need, entry, Report()) is True
    need.refresh_from_db()
    assert (need.postponed, need.q4) == (3, 3)
    assert _precise_line(need, entry, Report()) is False
