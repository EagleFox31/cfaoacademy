"""Liste des stagiaires : import (formes du classeur tenu à la main), remplacement par
exercice, garde-fous, synthèse agrégée et accès. Personnes fictives uniquement."""
import datetime as dt
import io
import json

import pytest
from django.core.management import call_command
from openpyxl import Workbook
from rest_framework.test import APIClient

from core.auth.principal import Principal
from core.models import ImportLog
from planning import views
from planning.imports.attendance_list import AttendanceListImporter, parse_any_date, parse_hours
from planning.management.commands.load_workbooks import discover
from planning.models import AttendanceOrigin, TraineeAttendance
from planning.services.attendance import attendance_summary
from referential.models import Country

pytestmark = pytest.mark.django_db
D = dt.date

# En-têtes du classeur 2026 (avec ses espaces et retours à la ligne).
HEAD_2026 = ["Centre de Formation", "N° de la \nFormation", "Marques", "Désignation formation",
             "Animateurs", "Date début formation", "Date fin formation", "Lieu de la formation",
             "Nb d'heure de formation", "Civillités", "Noms ", "Prénoms ", "Pays stagiaires",
             "Présence à la formation", "Nom du client interne ou externe", "Type de formation"]
# En-têtes 2024 : durée et filiales nommées autrement.
HEAD_2024 = ["Centre de Formation", "N° de la \nFormation", "Désignation formation",
             "Date début formation", "Date fin formation", "Durée de la formation (heures)",
             "Noms ", "Prénoms ", "Pays stagiaires", "Présence à la formation", "Filiales"]


def _book(head, rows, sheet="Liste stagiaires 2026", first_sheet=None) -> io.BytesIO:
    wb = Workbook()
    ws = wb.active
    if first_sheet:
        ws.title = first_sheet
        ws = wb.create_sheet(sheet)
    else:
        ws.title = sheet
    ws.append(head)
    for row in rows:
        ws.append(row)
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream


def _row(number, last, first="X", present="Présent", start=D(2026, 3, 2), end=D(2026, 3, 6),
         hours=40, center="MOTORS", country="Cameroun"):
    return [center, number, "MARQUE", f"Formation {number}", "Formateur fictif", start, end,
            "Douala", hours, "M.", last, first, country, present, "Filiale fictive", "Présentiel"]


@pytest.fixture
def cameroun():
    return Country.objects.create(code="CMR", label="Cameroun")


def _import(stream, year=2026):
    importer = AttendanceListImporter(year)
    result = importer.parse(stream)
    return result, importer.apply(result, actor="test")


def test_formes_du_classeur_tenu_a_la_main():
    assert parse_any_date("d", "16 Juin. 2025") == D(2025, 6, 16)
    assert parse_any_date("d", "06 mars. 2025") == D(2025, 3, 6)
    assert parse_any_date("d", "24 Nov. 2024") == D(2024, 11, 24)
    assert parse_any_date("d", "30 mai. 2025") == D(2025, 5, 30)
    assert parse_any_date("d", "10 Fév.2025") == D(2025, 2, 10)
    assert parse_any_date("d", "14 avril ,2025") == D(2025, 4, 14)
    assert parse_any_date("d", "12/02/2026") == D(2026, 2, 12)
    assert parse_hours("8h") == 8 and parse_hours(40.0) == 40 and parse_hours("?") is None


def test_import_2026_ecrit_les_lignes_sans_nom_dans_le_rapport(cameroun):
    rows = [_row(1, "ALPHA"), _row(1, "BRAVO", present=None), _row(2, "ALPHA", present="Absent"),
            [None] * len(HEAD_2026)]  # ligne vide : ignorée sans bruit
    result, log = _import(_book(HEAD_2026, rows))

    assert log.status == ImportLog.Status.APPLIED and log.rows_written == 3
    alpha = TraineeAttendance.objects.get(training_key="1", present=True)
    assert alpha.country == cameroun and alpha.hours == 40 and alpha.delivery_mode == "PRESENTIEL"
    assert TraineeAttendance.objects.get(training_key="1", present=None).first_name == "X"
    assert "ALPHA" not in json.dumps(log.report) and "BRAVO" not in json.dumps(log.report)


def test_ligne_sans_nom_ignoree_et_comptee():
    rows = [_row(1, "ALPHA"), _row(1, None)]
    result, log = _import(_book(HEAD_2026, rows))
    assert log.rows_written == 1 and log.report["rows_skipped"] == 1


def test_classeur_2024_feuille_non_premiere_et_dates_texte():
    rows = [["MOTORS", 7, "Formation 7", "24 Nov. 2024", "28 Nov. 2024", "8h",
             "ALPHA", "X", "Cameroun", None, "Filiale fictive"]]
    result, log = _import(_book(HEAD_2024, rows, sheet="Liste stagiaires 2024", first_sheet="Feuil2"),
                          year=2024)
    assert log.status == ImportLog.Status.APPLIED, log.report
    row = TraineeAttendance.objects.get(year=2024)
    assert (row.start_date, row.hours, row.subsidiary, row.country) == (
        D(2024, 11, 24), 8, "Filiale fictive", None)


def test_fin_avant_debut_ramenee_au_debut_et_tracee():
    rows = [_row(1, "ALPHA", start=D(2026, 5, 4), end=D(2026, 4, 30))]
    _, log = _import(_book(HEAD_2026, rows))
    assert log.status == ImportLog.Status.APPLIED
    assert TraineeAttendance.objects.get().end_date == D(2026, 5, 4)
    assert log.report["normalizations"][0]["from"] == "2026-04-30"


def test_intitule_vide_accepte_si_le_numero_identifie_la_formation():
    sans_titre_avec_no, sans_titre_ni_no = _row(5, "ALPHA"), _row(None, "BRAVO")
    sans_titre_avec_no[3] = sans_titre_ni_no[3] = None
    _, log = _import(_book(HEAD_2026, [sans_titre_avec_no]))
    assert log.status == ImportLog.Status.APPLIED
    _, log = _import(_book(HEAD_2026, [sans_titre_ni_no]))
    assert log.report["errors"][0]["code"] == "REQUIRED"


def test_saisie_inachevee_ignoree_sans_bloquer_l_exercice():
    inachevee = [None, None, None, None, None, D(2026, 3, 2), D(2026, 3, 6), None, 8,
                 None, "BRAVO", None, None, None, "Filiale fictive", None]
    _, log = _import(_book(HEAD_2026, [_row(1, "ALPHA"), inachevee]))
    assert log.status == ImportLog.Status.APPLIED and log.rows_written == 1
    assert log.report["rows_skipped"] == 1 and "BRAVO" not in json.dumps(log.report)


def test_doublon_fusionne_present_si_l_une_des_lignes_le_dit():
    rows = [_row(1, "ALPHA", present=None), _row(1, "Alpha ", present="Présent")]
    result, log = _import(_book(HEAD_2026, rows))
    assert log.rows_written == 1 and log.report["duplicates_merged"] == 1
    assert TraineeAttendance.objects.get().present is True


def test_presence_illisible_refuse_le_fichier_sans_citer_la_personne():
    result, log = _import(_book(HEAD_2026, [_row(1, "ALPHA", present="peut-être")]))
    assert log.status == ImportLog.Status.REJECTED
    assert log.report["errors"][0]["code"] == "INVALID_PRESENCE"
    assert "ALPHA" not in json.dumps(log.report)
    assert not TraineeAttendance.objects.exists()


def test_nouvelle_version_remplace_l_import_mais_jamais_la_saisie():
    _import(_book(HEAD_2026, [_row(1, "ALPHA"), _row(1, "BRAVO")]))
    TraineeAttendance.objects.create(
        year=2026, training_key="9", title="Saisie", start_date=D(2026, 5, 4), end_date=D(2026, 5, 8),
        last_name="CHARLIE", person_key="k", present=True, origin=AttendanceOrigin.MANUAL)

    _, log = _import(_book(HEAD_2026, [_row(1, "ALPHA"), _row(1, "BRAVO"), _row(3, "DELTA")]))

    assert log.report["replaced"] == 2 and log.report["created"] == 3
    assert TraineeAttendance.objects.filter(origin=AttendanceOrigin.IMPORT).count() == 3
    assert TraineeAttendance.objects.filter(origin=AttendanceOrigin.MANUAL).count() == 1


def test_classeur_tronque_refuse(cameroun):
    _import(_book(HEAD_2026, [_row(i, "ALPHA") for i in range(1, 11)]))
    _, log = _import(_book(HEAD_2026, [_row(1, "ALPHA"), _row(2, "ALPHA")]))
    assert log.status == ImportLog.Status.REJECTED and "tronqué" in log.report["fatal"]
    assert TraineeAttendance.objects.count() == 10


def test_discover_derniere_version_par_annee(tmp_path):
    def touch(name):
        path = tmp_path / name
        path.write_bytes(b"x")
        return path

    touch("Liste des participants aux formations 2024 V2.xlsx")
    v3 = touch("Liste des participants aux formations 2024 V3.xlsx")
    y25 = touch("Liste des participants aux formations 2025.xlsx")
    touch("Copie de Liste des participants aux formations 2025 V9.xlsx")

    plan = discover([tmp_path])

    assert plan == [("attendance_list", v3, {"year": "2024"}),
                    ("attendance_list", y25, {"year": "2025"})]


def test_load_workbooks_idempotent(tmp_path):
    path = tmp_path / "Liste des participants aux formations 2026 V2.xlsx"
    path.write_bytes(_book(HEAD_2026, [_row(1, "ALPHA")]).getvalue())

    call_command("load_workbooks", str(tmp_path))
    call_command("load_workbooks", str(tmp_path))

    assert ImportLog.objects.filter(kind="attendance_list").count() == 1
    assert TraineeAttendance.objects.count() == 1


def test_synthese_compte_les_formations_terminees_et_les_presents():
    _import(_book(HEAD_2026, [
        _row(1, "ALPHA"), _row(1, "BRAVO", present="Absent"), _row(1, "CHARLIE", present=None),
        _row(2, "ALPHA", center="EQUIPMENT", start=D(2026, 4, 6), end=D(2026, 4, 10)),
        _row(3, "DELTA", start=D(2026, 12, 7), end=D(2026, 12, 11)),  # pas encore terminée
    ]))

    s = attendance_summary(2026, today=D(2026, 11, 20))

    assert s["loaded"] is True
    assert (s["trainings_planned"], s["trainings_completed"]) == (3, 2)
    assert (s["participations"], s["participations_present"], s["presence_unknown"]) == (4, 2, 1)
    assert s["people_trained"] == 1  # ALPHA formé deux fois = une personne
    assert s["by_center"] == [
        {"center": "EQUIPMENT", "trainings_completed": 1, "participations_present": 1},
        {"center": "MOTORS", "trainings_completed": 1, "participations_present": 1},
    ]


def test_synthese_annee_vide():
    s = attendance_summary(2030, today=D(2026, 11, 20))
    assert s["loaded"] is False and s["participations_present"] == 0 and s["by_center"] == []


def _client(role):
    c = APIClient()
    c.force_authenticate(user=Principal(id=f"u_{role}", roles=[role], display_name=role,
                                        attr={"scopeNodes": ["cfao"], "locale": "fr"}))
    return c


def test_endpoint_agrege_sans_nom_et_refuse_hors_role(monkeypatch):
    _import(_book(HEAD_2026, [_row(1, "ALPHA")]))
    seen = {}

    def check(p, kind, rid, attr, action):
        seen.update(kind=kind, rid=rid, attr=attr, action=action)
        return "training_coordinator" in p["roles"]

    monkeypatch.setattr(views.cerbos, "check", check)
    url = "/api/v1/planning/years/2026/attendance-summary"
    assert _client("center_assistant").get(url).status_code == 403
    res = _client("training_coordinator").get(url)
    assert res.status_code == 200
    assert seen == {"kind": "planning_attendance", "rid": "2026",
                    "attr": {"orgPath": ["groupe"], "year": 2026}, "action": "view"}
    assert res.json()["year"] == 2026 and "ALPHA" not in res.content.decode()
