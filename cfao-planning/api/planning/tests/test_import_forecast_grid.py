"""Import C : copie brute des bandes de session de la grille « Plannings formateurs »."""
import datetime as dt
import io

import pytest
from openpyxl import Workbook
from openpyxl.styles import PatternFill

from planning.imports.forecast_grid import ForecastGridImporter
from planning.models import GridBand, PlannedSession, Session

pytestmark = pytest.mark.django_db

ORANGE = PatternFill("solid", fgColor="FFFFC000")  # filiale
YELLOW = PatternFill("solid", fgColor="FFFFFF00")  # Academy de Douala
TITLE = PatternFill("solid", fgColor="FFFFFF99")
THEME = PatternFill("solid", fgColor="FFDDEBF7")
PURPLE = PatternFill("solid", fgColor="FF7030A0")


def grid(year=2027, sheet="Calendrier-MOBILITY", extra=True):
    wb = Workbook()
    ws = wb.active
    ws.title = sheet
    ws["A1"] = f"SERVICE FORMATION MOTORS - {year}"
    ws["A3"], ws["B3"], ws["C3"] = "Mois", "Marques", "Formateurs"
    for day in range(1, 32):
        ws.cell(3, 3 + day, day)
    ws["A4"] = "JANVIER"
    ws.merge_cells("A4:A12")
    ws["B4"], ws["C4"] = "TOYOTA", "Eugène EBENE"

    ws.merge_cells("H4:L4")  # jours 5 à 9, en filiale
    ws["H4"], ws["H4"].fill = "TS07-G3 - TOYOTA- SENEGAL", ORANGE
    ws.merge_cells("H5:L6")
    ws["H5"], ws["H5"].fill = "Maintenance périodique", TITLE

    ws.merge_cells("O6:S6")  # jours 12 à 16, à Douala, sur la 3e ligne du formateur
    ws["O6"], ws["O6"].fill = "SNM01", YELLOW
    ws.merge_cells("O7:S8")
    ws["O7"], ws["O7"].fill = "Moteurs essence", THEME

    ws.merge_cells("V4:Z4")  # couleur hors site : ignorée
    ws["V4"], ws["V4"].fill = "Jour férié", PURPLE
    ws.merge_cells("AB4:AF4")  # bande vide : ignorée
    ws["AB4"].fill = YELLOW

    if extra:
        ws["B10"] = "Formations Reportées"
        ws.merge_cells("H10:L10")
        ws["H10"], ws["H10"].fill = "TS03-G3-Tchad", ORANGE

    ws["A13"] = "FEVRIER"
    ws["B13"], ws["C13"] = "TOYOTA", "Eugène EBENE"
    ws.merge_cells("AD13:AH13")  # 27 au 31 février : hors du mois
    ws["AD13"], ws["AD13"].fill = "TS04-G3", YELLOW

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _apply(stream, year=2027):
    importer = ForecastGridImporter(year)
    result = importer.parse(stream)
    return result, importer.apply(result, actor="test")


def test_bandes_filiale_et_douala_avec_intitule_formateur_et_section():
    result, log = _apply(grid())
    assert result.ok, result.as_report()
    assert log.status == "APPLIED"
    bands = {b.text: b for b in GridBand.objects.all()}
    assert set(bands) == {"TS07-G3 - TOYOTA- SENEGAL", "SNM01", "TS03-G3-Tchad"}

    senegal = bands["TS07-G3 - TOYOTA- SENEGAL"]
    assert (senegal.start_date, senegal.end_date) == (dt.date(2027, 1, 5), dt.date(2027, 1, 9))
    assert (senegal.fill_key, senegal.pole, senegal.cell) == ("rgb:FFFFC000", "MOTORS", "H4")
    assert senegal.title == "Maintenance périodique"
    assert (senegal.trainer_raw, senegal.section) == ("Eugène EBENE", "TOYOTA")

    douala = bands["SNM01"]
    assert douala.title == "Moteurs essence"  # intitulé en couleur de thème
    assert douala.trainer_raw == "Eugène EBENE"  # 3e ligne du formateur

    reportee = bands["TS03-G3-Tchad"]
    assert (reportee.section, reportee.trainer_raw) == ("FORMATIONS REPORTEES", "")
    assert result.extra["out_of_month"] == ["Calendrier-MOBILITY!AD13"]


def test_ni_session_ni_session_prevue():
    _apply(grid())
    assert Session.objects.count() == 0 and PlannedSession.objects.count() == 0


def test_annee_incoherente_refusee_sans_ecriture():
    result, log = _apply(grid(year=2026), year=2027)
    assert result.fatal == "YEAR_MISMATCH"
    assert log.status == "REJECTED"
    assert GridBand.objects.count() == 0


def test_second_passage_sans_ecriture():
    _apply(grid())
    _, log = _apply(grid())
    assert log.rows_written == 0
    assert GridBand.objects.count() == 3


def test_nouvelle_version_retire_les_bandes_disparues():
    _apply(grid())
    _, log = _apply(grid(extra=False))
    assert log.report["removed"] == 1
    assert not GridBand.objects.filter(text="TS03-G3-Tchad").exists()


def test_lot_vide_ne_supprime_rien():
    _apply(grid())
    wb = Workbook()
    ws = wb.active
    ws.title = "Calendrier-MOBILITY"
    ws["A1"] = "SERVICE FORMATION MOTORS - 2027"
    for day in range(1, 32):
        ws.cell(3, 3 + day, day)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    _apply(buf)
    assert GridBand.objects.count() == 3


def test_equipment_range_dans_son_pole():
    _apply(grid(sheet="Calendrier-EQUIPMENT"))
    assert set(GridBand.objects.values_list("pole", flat=True)) == {"EQUIPMENT"}
