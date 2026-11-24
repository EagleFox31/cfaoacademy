"""Calendrier annuel de formation : couleurs de la légende, jours fériés, ordre des lignes, accès."""
import datetime as dt
import io

import pytest
from openpyxl import Workbook
from openpyxl.styles import PatternFill
from openpyxl.styles.colors import Color
from rest_framework.test import APIClient

from core.auth.principal import Principal
from planning import views
from planning.imports.forecast_grid import ForecastGridImporter
from planning.models import GridBand
from planning.services.training_calendar import training_calendar

pytestmark = pytest.mark.django_db

ORANGE = PatternFill("solid", fgColor="FFFFC000")
GREEN = PatternFill("solid", fgColor="FF92D050")
BLACK = PatternFill("solid", fgColor=Color(theme=1))  # « Congés » : couleur de thème du texte
PURPLE = PatternFill("solid", fgColor="FF7030A0")


def grid():
    wb = Workbook()
    ws = wb.active
    ws.title = "Calendrier-MOBILITY"
    ws["A1"] = "SERVICE FORMATION MOTORS - 2027"
    ws["A3"], ws["B3"], ws["C3"] = "Mois", "Marques", "Formateurs"
    for day in range(1, 32):
        ws.cell(3, 3 + day, day)
    ws["A4"] = "JANVIER"
    ws.merge_cells("A4:A12")
    ws["B4"], ws["C4"] = "TOYOTA", "Formateur A"
    ws["B7"], ws["C7"] = "CARROSSERIE", "Formateur B"
    for row in range(4, 13):  # 1er janvier : toute la colonne en violet
        ws.cell(row, 4).fill = PURPLE
    ws["E10"].fill = PURPLE  # case violette isolée : pas un jour férié

    ws.merge_cells("H4:L4")
    ws["H4"], ws["H4"].fill = "TS07-G3 - SENEGAL", ORANGE
    ws.merge_cells("O7:S7")
    ws["O7"], ws["O7"].fill = "TTT TOYOTA Japon", GREEN
    ws["O8"] = "Formation de formateur carrosserie"
    ws.merge_cells("V4:Z4")
    ws["V4"], ws["V4"].fill = "Congés", BLACK

    ws["A13"] = "FEVRIER"
    ws["B13"], ws["C13"] = "CARROSSERIE", "Formateur B"  # seul en février : garde sa place après A
    ws.merge_cells("H13:L13")
    ws["H13"], ws["H13"].fill = "TS09 - Benin", ORANGE
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


@pytest.fixture
def importe():
    importer = ForecastGridImporter(2027)
    result = importer.parse(grid())
    assert result.ok, result.as_report()
    importer.apply(result, actor="test")


def test_import_garde_les_couleurs_de_la_legende_et_les_jours_feries(importe):
    fills = {b.text: b.fill_key for b in GridBand.objects.all()}
    assert fills["TTT TOYOTA Japon"] == "rgb:FF92D050"
    assert fills["Congés"] == "theme:1:0"
    feries = GridBand.objects.filter(section="JOURS FERIES")
    assert [b.start_date for b in feries] == [dt.date(2027, 1, 1)]


def test_calendrier_lignes_bandes_et_feries(importe):
    cal = training_calendar(2027, "MOTORS")
    assert cal["holidays"] == ["2027-01-01"]
    trainers = [line["trainer"] for line in cal["lines"]]
    assert trainers[:2] == ["Formateur A", "Formateur B"]
    assert [line["section"] for line in cal["lines"][-2:]] == ["FORMATIONS REPORTEES", "FORMATIONS ANNULEES"]
    kinds = {b["text"]: b["kind"] for b in cal["bands"]}
    assert kinds["TS07-G3 - SENEGAL"] == "subsidiary"
    assert kinds["TTT TOYOTA Japon"] == "trainers"
    assert kinds["Congés"] == "leave"
    ttt = next(b for b in cal["bands"] if b["kind"] == "trainers")
    assert (ttt["start"], ttt["end"], ttt["title"]) == ("2027-01-12", "2027-01-16",
                                                          "Formation de formateur carrosserie")
    assert training_calendar(2027, "EQUIPMENT")["empty"] is True


def test_nom_complet_du_formateur_pays_et_marque_par_bande(referential):
    import hashlib

    GridBand.objects.create(
        year=2027, pole="MOTORS", sheet="Calendrier-MOBILITY", cell="H4", text="TS07-G3 - TOYOTA- RCI",
        fill_key="rgb:FFFFC000", start_date=dt.date(2027, 3, 1), end_date=dt.date(2027, 3, 5),
        trainer_raw="Eugene", section="TOYOTA", fingerprint=hashlib.sha256(b"x").hexdigest())
    cal = training_calendar(2027, "MOTORS")
    line = next(li for li in cal["lines"] if li["trainer"] == "Eugene")
    assert line["trainer_name"] == "Eugène EBENE"
    band = cal["bands"][0]
    assert (band["country"], band["country_label"], band["brand"]) == ("ci", "Côte d'Ivoire", "TOYOTA")


def test_le_previsionnel_ne_lit_toujours_que_filiale_et_douala(importe):
    from planning.imports.forecast_grid import SITE_BY_FILL
    assert "rgb:FF92D050" not in SITE_BY_FILL


def test_ordre_des_lignes_tranche_par_la_majorite_des_mois():
    from planning.services.training_calendar import _merge, _settle
    months = [["a", "c"], ["a", "b", "c"], ["a", "b", "c"]]  # b absent du premier mois
    order = []
    for seen in months:
        _merge(order, seen)
    assert _settle(order, months) == ["a", "b", "c"]
    months = [["a", "c"], ["c", "b"], ["a", "b", "c"], ["a", "b", "c"]]
    order = []
    for seen in months:
        _merge(order, seen)
    assert _settle(order, months) == ["a", "b", "c"]


def _client(role):
    c = APIClient()
    c.force_authenticate(user=Principal(id=f"u_{role}", roles=[role], display_name=role,
                                        attr={"scopeNodes": ["cfao"], "locale": "fr"}))
    return c


def test_endpoint_equipe_du_centre(importe, monkeypatch):
    monkeypatch.setattr(views.cerbos, "check", lambda p, kind, rid, attr, action:
                        kind == "planning_calendar" and "center_assistant" in p["roles"])
    url = "/api/v1/planning/years/2027/calendar/motors"
    assert _client("dps").get(url).status_code == 403
    res = _client("center_assistant").get(url)
    assert res.status_code == 200 and res.json()["pole"] == "MOTORS"
    assert _client("center_assistant").get("/api/v1/planning/years/2027/calendar/autre").status_code == 404
