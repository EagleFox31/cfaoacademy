"""Import B : la grille complète Data, elle ne la remplace pas."""
import datetime as dt
import io

import pytest
from openpyxl import Workbook
from openpyxl.styles import PatternFill

from core.imports.models import ImportLog
from planning.imports.calendar_grid import CalendarGridImporter
from planning.models import Absence, Category, ReviewItem, Session, SessionAssignment
from referential.models import AbsenceKeyword, ColorRule

pytestmark = pytest.mark.django_db

YELLOW = PatternFill("solid", fgColor="FFFFC000")
TITLE = PatternFill("solid", fgColor="FFFFFF99")
UNKNOWN = PatternFill("solid", fgColor="FF123456")


def _rules():
    ColorRule.objects.create(fill_key="rgb:FFFFC000", category="CLIENT", label_fr="Client")
    ColorRule.objects.create(fill_key="rgb:FFFFFF99", category="TITLE", label_fr="Intitulé")
    AbsenceKeyword.objects.create(pattern_norm="CONGES", kind="LEAVE")
    AbsenceKeyword.objects.create(pattern_norm="CONGE", kind="LEAVE")


def _grid():
    wb = Workbook()
    ws = wb.active
    ws.title = "Calendrier-Motors"
    ws["A3"], ws["B3"], ws["C3"] = "Mois", "Marques", "Formateurs"
    for day in range(1, 32):
        ws.cell(3, 3 + day, day)

    ws["A4"] = "JANVIER"
    ws.merge_cells("A4:A8")
    ws["B4"] = "TOYOTA"
    ws["C4"] = "EUGENE EBENE"

    ws.merge_cells("H4:L4")  # jours 5 à 9
    ws["H4"] = "Conges"

    ws.merge_cells("O4:S4")  # jours 12 à 16
    ws["O4"] = "TS03 - G3 - Douala"
    ws["O4"].fill = YELLOW
    ws["O5"] = "Révision des moteurs"
    ws["O5"].fill = TITLE

    ws.merge_cells("V4:Z4")  # jours 19 à 23
    ws["V4"] = "Stage mystere"
    ws["V4"].fill = UNKNOWN

    ws.merge_cells("H7:I7")  # jours 5 à 6, autre texte
    ws["C7"] = "EUGENE EBENE"
    ws["H7"] = "BT Congo"

    ws["A10"] = "FEVRIER"
    ws["C10"] = "EUGENE EBENE"
    ws.merge_cells("AD10:AH10")  # jours 27 à 31, février n'a pas 31
    ws["AD10"] = "Conges"

    ws["D8"] = "Note loin"
    for day in range(1, 32):
        ws.cell(9, 3 + day, day)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _session(referential):
    session = Session.objects.create(
        year=2026, brand=referential["toyota"], training_type="TECHNIQUE",
        code_norm="TS03-G3", code_raw="TS03 - G3", title="Moteur",
        country=referential["cm"], location="Douala",
        start_date=dt.date(2026, 1, 12), end_date=dt.date(2026, 1, 16), days=5,
    )
    SessionAssignment.objects.create(session=session, trainer=referential["eugene"], role="LEAD")
    return session


def test_absence_statut_et_revue_sans_creer_de_session(referential):
    _rules()
    session = _session(referential)
    importer = CalendarGridImporter(2026)
    result = importer.parse(_grid())
    assert result.ok, result.as_report()
    assert result.extra["colors_found"]["rgb:FFFFC000"] == 1

    log = importer.apply(result, actor="tester")
    assert log.status == ImportLog.Status.APPLIED
    assert Session.objects.count() == 1

    absence = Absence.objects.get()
    assert absence.trainer_id == referential["eugene"].pk
    assert absence.kind == "LEAVE"
    assert (absence.start_date, absence.end_date) == (dt.date(2026, 1, 5), dt.date(2026, 1, 9))
    assert absence.origin == "GRID"

    session.refresh_from_db()
    assert session.category == Category.CLIENT
    assert session.version == 2

    reasons = set(ReviewItem.objects.values_list("reason", flat=True))
    assert ReviewItem.Reason.NOT_IN_DATA in reasons  # Stage mystere et BT Congo
    assert ReviewItem.Reason.CODE_UNPARSEABLE in reasons  # 27-31 février
    assert not ReviewItem.objects.filter(proposed__text="Révision des moteurs").exists()
    assert "BT Congo" in [item.proposed.get("text") for item in ReviewItem.objects.all()]
    notes = [item for item in ReviewItem.objects.all() if item.proposed.get("text") == "Note loin"]
    assert len(notes) == 1 and notes[0].proposed["trainer"] == "EUGENE EBENE"
    assert not ReviewItem.objects.filter(proposed__text="1").exists()


def test_reimport_ne_duplique_pas_la_revue_ni_l_absence(referential):
    _rules()
    _session(referential)
    first = CalendarGridImporter(2026)
    log = first.apply(first.parse(_grid()), actor="tester")
    assert log.status == ImportLog.Status.APPLIED
    reviews = ReviewItem.objects.count()
    second = CalendarGridImporter(2026)
    second.apply(second.parse(_grid()), actor="tester")
    assert ReviewItem.objects.count() == reviews
    assert Absence.objects.count() == 1
