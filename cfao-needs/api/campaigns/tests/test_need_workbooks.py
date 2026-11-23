"""Fiches de besoins des filiales : lecture des classeurs."""
from types import SimpleNamespace

import pytest
from openpyxl import Workbook, load_workbook
from openpyxl.styles import PatternFill

from campaigns.imports.need_workbooks import (
    Report, _merge, _need_fields, _precise_line, canonical_brand, canonical_code, parse_directory,
    parse_workbook, pending_files, unknown_files, validated_pairs,
)
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


@pytest.mark.parametrize("name, sheet, org", [
    ("Fiche besoins EQUIPMENT 2027 v1 RGE.xlsx", "EQUIPMENT", "groupe.gnq"),
    ("MOBILITY 2027 Formulaire besoins formation RGE.xlsx", " TECHNIQUE ", "groupe.gnq"),
    ("MOBILITY 2027_Tchad.xlsx", " TECHNIQUE ", "groupe.tcd"),
    ("MOBILITY 2027_Inconnu.xlsx", " TECHNIQUE ", None),
    ("EQUIPMENT 2027 Training Needs Identification Form_Ghana.xlsx", "EQUIPMENT", "groupe.gha"),
    ("Fiche EQUIPMENT 2027 v1_Burkina Faso.xlsx", "EQUIPMENT", "groupe.bfa"),
    ("MOBILITY 2027 Formulaire besoins formation_Cameroun_Toyota.xlsx", " TECHNIQUE ", "groupe.cmr"),
    ("Fiche EQUIPMENT 2027 v1_Mali.xlsx", "EQUIPMENT", "groupe.mli"),
    ("MOBILITY 2027 Formulaire besoins formation_Benin.xlsx", " TECHNIQUE ", "groupe.ben"),
    ("MOBILITY 2027 Formulaire besoins formation_Guinée.xlsx", " TECHNIQUE ", "groupe.gin"),
    ("MOBILITY 2027 Formulaire besoins formation_Guinée équatoriale.xlsx", " TECHNIQUE ", "groupe.gnq"),
    ("MOBILITY 2027 Formulaire besoins formation RDC.xlsx", " TECHNIQUE ", "groupe.cod"),
    ("MOBILITY 2027 Formulaire besoins formation v1_Congo.xlsx", " TECHNIQUE ", "groupe.cog"),
    # Mots entiers : un nom qui contient « mali » ou « rge » sans les porter n'est pas reconnu.
    ("Fiche normalisée EQUIPMENT 2027 large.xlsx", "EQUIPMENT", None),
])
def test_filiale_reconnue_au_nom_du_fichier(tmp_path, name, sheet, org):
    path = _save(tmp_path, name, sheet, [
        ["Titre"], HEADER, QUARTERS,
        ["SENIOR", "SUZUKI", "SS03-ARGENT", "T", "Diag", 9, 2],
    ])
    rows = parse_workbook(path)
    assert [r.org for r in rows] == ([org] if org else [])


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
    # Sans couleur : besoin exprimé, attribué à aucune session, même avec un lieu écrit.
    class _Lines:  # une ligne de catalogue par code, sans base
        def line_for(self, row):
            return SimpleNamespace(pk=row.code)
    entries = list(_merge([green, red, written_elsewhere, plain], _Lines()).values())
    assert [(e["postponed"], e["unassigned"]) for e in entries] == [(0, 0), (3, 0), (0, 0), (0, 2)]
    assert _need_fields(entries[3])["unassigned"] == 2
    assert "Non attribué sur la fiche : 2 place(s)." in _need_fields(entries[3])["comment"]
    assert _need_fields(entries[0])["comment"] == ""


def test_case_bleue_attribuee_a_douala(tmp_path):
    path = _save(tmp_path, "MOBILITY 2027_Tchad.xlsx", "TECHNIQUE", [
        ["Titre"], HEADER, QUARTERS,
        ["SENIOR", "TOYOTA", "TS06-G3", "T", "A", 9, None, None, 3],
    ])
    _paint(path, {"I4": "FF00B0F0"})
    (blue,) = parse_workbook(path)
    assert blue.place_of(2) == "ACADEMY"

    class _Lines:
        def line_for(self, row):
            return SimpleNamespace(pk=row.code)
    (entry,) = _merge([blue], _Lines()).values()
    assert (entry["postponed"], entry["unassigned"]) == (0, 0), "bleu = attribué, pas « sans couleur »"


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
    entry = {"line": line, "q": [0, 0, 0, 3], "places": ["", "", "", "ACADEMY"], "postponed": 3,
             "unassigned": 0}

    assert _precise_line(need, entry, Report()) is True
    need.refresh_from_db()
    assert (need.postponed, need.q4) == (3, 3)
    assert _precise_line(need, entry, Report()) is False


@pytest.mark.django_db
def test_non_attribue_precise_une_ligne_existante_une_seule_fois():
    campaign = Campaign.objects.create(year=2027, label="2027")
    family = CatalogFamily.objects.create(key="f", label="F", pole="MOBILITY")
    line = CatalogLine.objects.create(campaign=campaign, family=family, code="TS06-G3", title="T")
    unit = OrgUnitRef.objects.create(code="ou-td", label="Tchad")
    submission = Submission.objects.create(campaign=campaign, org_unit=unit, country="TCHAD",
                                           status=Submission.Status.VALIDATED)
    need = NeedLine.objects.create(submission=submission, catalog_line=line, q3=3)
    entry = {"line": line, "q": [0, 0, 3, 0], "places": ["", "", "", ""], "postponed": 0, "unassigned": 3}

    assert _precise_line(need, entry, Report()) is True
    need.refresh_from_db()
    assert (need.unassigned, need.postponed, need.q3) == (3, 0, 3)
    assert need.comment.count("Non attribué") == 1
    assert _precise_line(need, entry, Report()) is False


GREEN = PatternFill("solid", fgColor="FF92D050")


def _suivi(tmp_path, rows):
    """Classeur de suivi : (pays, pôle, RDV vert ?, rapport, calendrier)."""
    book = Workbook()
    sheet = book.active
    sheet.title = "RDV"
    sheet.append(["PAYS", "PÔLE", "DOP/DPS", "RDV", "RAPPORT RDV", "CALENDRIER"])
    for number, (country, pole, green, report, calendar) in enumerate(rows, start=2):
        sheet.append([country, pole, None, "2026-10-27", report, calendar])
        if green:
            sheet.cell(number, 4).fill = GREEN
    path = tmp_path / "Suivi 2027.xlsx"
    book.save(path)
    return path


def test_fiche_validee_seulement_si_rdv_vert_rapport_et_calendrier(tmp_path):
    path = _suivi(tmp_path, [
        ("Tchad", "Mobility", True, "Yes", "Yes"),
        ("Tchad", "Equipment", True, "Yes", None),
        ("Togo", "Equipment", False, "Yes", "Yes"),
        ("RGE", "Equipment", True, "yes ", "YES"),
        ("Atlantide", "Mobility", True, "Yes", "Yes"),
    ])
    assert validated_pairs(path) == {("groupe.tcd", "MOBILITY"), ("groupe.gnq", "EQUIPMENT")}


def test_suivi_sans_feuille_rdv_refuse(tmp_path):
    path = tmp_path / "Suivi 2027.xlsx"
    Workbook().save(path)
    with pytest.raises(ValueError):
        validated_pairs(path)


def test_dossier_lu_en_profondeur_et_fiches_non_validees_ecartees(tmp_path):
    row = ["SENIOR", "SUZUKI", "SS05", "T", "Diag", 9, 2]
    for sub, name in (("Mobility 2027", "MOBILITY 2027_Tchad.xlsx"),
                      ("Equipment 2027", "Fiche EQUIPMENT 2027_Tchad.xlsx"),
                      ("Formulaires vierges", "MOBILITY 2027 Formulaire.xlsx")):
        (tmp_path / sub).mkdir()
        sheet = "EQUIPMENT" if "EQUIPMENT" in name else "TECHNIQUE"
        _save(tmp_path / sub, name, sheet, [["Titre"], HEADER, QUARTERS, row])
    pairs = validated_pairs(_suivi(tmp_path, [("Tchad", "Mobility", True, "Yes", "Yes")]))
    assert {r.source for r in parse_directory(tmp_path)} == {
        "MOBILITY 2027_Tchad.xlsx", "Fiche EQUIPMENT 2027_Tchad.xlsx"}
    assert {r.source for r in parse_directory(tmp_path, pairs)} == {"MOBILITY 2027_Tchad.xlsx"}
    assert pending_files(tmp_path, pairs) == ["Fiche EQUIPMENT 2027_Tchad.xlsx"]
    assert unknown_files(tmp_path) == []


@pytest.mark.django_db
def test_commande_json_detail_par_fichier_sous_4_ko(tmp_path):
    import io
    import json

    from django.core.management import call_command
    Campaign.objects.create(year=2027, label="2027")
    OrgUnitRef.objects.create(code="groupe.tcd", label="Tchad", country="TCHAD")
    CatalogFamily.objects.create(key="techniques-motors", label="Techniques", pole="MOBILITY")
    row = ["SENIOR", None, "SS05", "T", "Diag", 9, 2]  # sans marque : formation transverse
    for name, sheet in (("MOBILITY 2027_Tchad.xlsx", "TECHNIQUE"),
                        ("Fiche EQUIPMENT 2027_Tchad.xlsx", "EQUIPMENT"),
                        ("MOBILITY 2027_Atlantide.xlsx", "TECHNIQUE")):
        _save(tmp_path, name, sheet, [["Titre"], HEADER, QUARTERS, row])
    suivi = _suivi(tmp_path, [("Tchad", "Mobility", True, "Yes", "Yes")])
    out = io.StringIO()
    call_command("import_need_workbooks", str(tmp_path), "--year", "2027",
                 "--validated-by", str(suivi), "--dry-run", "--json", stdout=out)
    last = out.getvalue().splitlines()[-1]
    assert last.startswith("JSON ") and len(last.encode()) < 4096
    detail = json.loads(last[5:])
    assert [(f["nom"], f["status"]) for f in detail["fichiers"]] == [
        ("MOBILITY 2027_Atlantide.xlsx", "ignore"),
        ("Fiche EQUIPMENT 2027_Tchad.xlsx", "en_attente"),
        ("MOBILITY 2027_Tchad.xlsx", "importe"),
    ]
    assert all(len(f["sha256"]) == 64 and f["type"] == "fiche_besoins" for f in detail["fichiers"])
    assert detail["fichiers"][2]["lignes"] == 1
    assert detail["compteurs"] == {"places_ajoutees": 2, "fiches_creees": 1, "en_attente": 1}
    assert not Submission.objects.exists()  # essai à blanc


@pytest.mark.django_db
def test_commande_sans_suivi_lisible_n_ecrit_rien(tmp_path):
    from django.core.management import CommandError, call_command
    Campaign.objects.create(year=2027, label="2027")
    with pytest.raises(CommandError):
        call_command("import_need_workbooks", str(tmp_path), "--year", "2027",
                     "--validated-by", str(tmp_path / "absent.xlsx"))
    assert not Submission.objects.exists()
