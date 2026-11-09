import datetime as dt

import pytest

from core.imports.models import ImportLog
from planning.imports.data_sheet import DataSheetImporter
from planning.models import Origin, Session, SessionAssignment

from .conftest import DATA_HEADERS, workbook_bytes

pytestmark = pytest.mark.django_db

ROW = ["TOYOTA", "TECHNIQUE", "TS03 - G3", "T-REF", "Moteur GD", "CFR", "Douala",
       dt.datetime(2026, 3, 2), dt.datetime(2026, 3, 6), "EUGENE EBENE / Lucien GAGNE",
       5, 8, 10, 40]


def run(rows, **kw):
    importer = DataSheetImporter()
    result = importer.parse(workbook_bytes(rows, **kw))
    return importer, result


def test_lit_la_feuille_data_meme_si_elle_n_est_pas_active(referential):
    _, result = run([ROW])
    assert result.ok, result.as_report()
    row = result.rows[0]
    assert row["code_norm"] == "TS03-G3"
    assert row["country_id"] == referential["cm"].pk
    assert row["year"] == 2026


def test_normalisations_tracees_code_pays_formateur(referential):
    _, result = run([ROW])
    rules = {(n.column, n.rule) for n in result.normalizations}
    assert ("Code", "code") in rules
    assert ("Pays hôte", "alias") in rules
    # « EUGENE EBENE » sans accent = forme normalisée exacte : pas une correction.
    assert ("Formateur", "alias") not in rules


def test_ecrit_sessions_et_affectations_lead_puis_co(referential):
    importer, result = run([ROW])
    log = importer.apply(result, actor="tester")
    assert log.status == ImportLog.Status.APPLIED
    session = Session.objects.get()
    assert session.origin == Origin.DATA
    assert session.org_path == ["cfao", "cm"]
    roles = dict(session.assignments.values_list("trainer__full_name", "role"))
    assert roles == {"Eugène EBENE": "LEAD", "Lucien GAGNE": "CO"}
    assert log.report["created"] == 1


def test_formateur_inconnu_rejette_tout_avec_suggestion(referential):
    bad = list(ROW)
    bad[9] = "Lucin GAGNE"
    importer, result = run([ROW, bad])
    assert not result.ok
    error = result.errors[0]
    assert error.code == "UNKNOWN_TRAINER" and error.row == 3
    assert "LUCIEN GAGNE" in error.message
    log = importer.apply(result)
    assert log.status == ImportLog.Status.REJECTED
    assert Session.objects.count() == 0  # tout ou rien


def test_doublon_sur_cle_naturelle_refuse(referential):
    twin = list(ROW)
    twin[2] = "TS03-G3"  # même clé une fois normalisé
    _, result = run([ROW, twin])
    assert [e.code for e in result.errors] == ["DUPLICATE_KEY"]


def test_coanimation_sur_deux_lignes_fusionnee(referential):
    """Cas réel du classeur 2025 (TP03, lignes 80-81) : un formateur par ligne."""
    first, second = list(ROW), list(ROW)
    first[9], second[9] = "Lucien GAGNE", "Eugène EBENE"
    importer, result = run([first, second])
    assert result.ok, result.as_report()
    assert len(result.rows) == 1
    assert any(n.rule == "merge_duplicate" and n.row == 3 for n in result.normalizations)
    importer.apply(result)
    roles = dict(Session.objects.get().assignments.values_list("trainer__full_name", "role"))
    assert roles == {"Lucien GAGNE": "LEAD", "Eugène EBENE": "CO"}


def test_meme_module_autre_date_n_est_pas_un_doublon(referential):
    other = list(ROW)
    other[7], other[8] = dt.datetime(2026, 6, 1), dt.datetime(2026, 6, 5)
    _, result = run([ROW, other])
    assert result.ok and len(result.rows) == 2


def test_reimport_met_a_jour_sans_dupliquer_et_signale_les_absents(referential):
    second = list(ROW)
    second[7], second[8] = dt.datetime(2026, 6, 1), dt.datetime(2026, 6, 5)
    importer, result = run([ROW, second])
    importer.apply(result)

    changed = list(ROW)
    changed[4] = "Moteur GD — révisé"
    changed[9] = "Lucien GAGNE"
    importer, result = run([changed])
    log = importer.apply(result)

    assert Session.objects.count() == 2  # jamais de suppression
    session = Session.objects.get(start_date=dt.date(2026, 3, 2))
    assert session.title == "Moteur GD — révisé" and session.version == 2
    assert list(session.assignments.values_list("role", flat=True)) == ["LEAD"]
    assert log.report["updated"] == 1
    assert [m["start_date"] for m in log.report["missing_from_file"]] == ["2026-06-01"]


def test_meme_fichier_reapplique_ne_fait_rien(referential):
    importer, result = run([ROW])
    first = importer.apply(result, file_sha256="abc")
    again = importer.apply(result, file_sha256="abc")
    assert again.pk == first.pk
    assert ImportLog.objects.count() == 1


def test_session_transverse_sans_marque(referential):
    row = list(ROW)
    row[0], row[1] = None, "PROCESS SAV"
    importer, result = run([row])
    assert result.ok, result.as_report()
    importer.apply(result)
    assert Session.objects.get().brand is None


def test_marque_par_alias(referential):
    row = list(ROW)
    row[0] = "OMODA & JAEECO"
    _, result = run([row])
    assert result.rows[0]["brand_id"] == referential["omoda"].pk


@pytest.mark.parametrize(
    "index,value,code",
    [
        (1, "FORMATION", "INVALID_CHOICE"),
        (7, "32/13/2026", "INVALID_DATE"),
        (8, dt.datetime(2026, 3, 1), "END_BEFORE_START"),
        (10, 9, "INVALID_DAYS"),
        (5, "Atlantide", "UNKNOWN_COUNTRY"),
        (0, "PEUGEOT", "UNKNOWN_BRAND"),
    ],
)
def test_lignes_invalides(referential, index, value, code):
    row = list(ROW)
    row[index] = value
    _, result = run([row])
    assert [e.code for e in result.errors] == [code]


def test_colonne_obligatoire_absente_est_fatale(referential):
    headers = [h for h in DATA_HEADERS if h != "PAYS HOTE"]
    row = [v for i, v in enumerate(ROW) if i != 5]
    _, result = run([row], headers=headers)
    assert "Pays hôte" in result.fatal
    assert SessionAssignment.objects.count() == 0
