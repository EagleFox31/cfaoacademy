import datetime as dt
import io
from decimal import Decimal

import pytest
from django.core.management import CommandError, call_command
from openpyxl import Workbook

from planning.imports.data_sheet import DataSheetImporter
from planning.imports.seat_sheets import SeatSheetsImporter
from planning.models import (
    CostKeyYear, PlannedAllocation, PlannedSession, ReviewItem, SeatAllocation, Session,
)
from planning.services.cost_key_freeze import freeze
from referential.models import Country, CountryAlias

from .conftest import workbook_bytes
from .test_import_data_sheet import ROW as DATA_ROW

pytestmark = pytest.mark.django_db

HEADERS = ["Marque", "Code", "Formation", "Date début", "Date fin", "Formateur", "Lieu",
           "Places Attribués 2026"]
MAR2 = dt.datetime(2026, 3, 2)
MAR9 = dt.datetime(2026, 3, 9)


def workbook(sheets: dict, extra_sheet: str = "MOTORS GLOBAL") -> io.BytesIO:
    """`sheets` : nom → lignes. Le pied « TOTAL » est ajouté avec la somme des places,
    sauf si la feuille le fournit elle-même."""
    wb = Workbook()
    wb.active.title = extra_sheet
    for name, rows in sheets.items():
        ws = wb.create_sheet(name)
        ws.append(HEADERS)
        for row in rows:
            ws.append(row)
        if not any(r and r[0] == "TOTAL" for r in rows):
            ws.append(["TOTAL", None, None, None, None, None, None,
                       sum(r[7] or 0 for r in rows)])
            ws.append(["COÛT CLE DE REPARTITION FILIALE", None, None, None, None, None, None, 1])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


@pytest.fixture
def world(referential):
    CountryAlias.objects.create(alias_norm="DOUALA", country=referential["cm"])
    ci = Country.objects.get(code="ci")
    CountryAlias.objects.create(alias_norm="ABIDJAN", country=ci)
    sn = Country.objects.create(code="sn", label="Sénégal", org_path=["cfao", "sn"])
    key = CostKeyYear.objects.create(year=2026, pole="MOTORS", budget=Decimal(1000))
    key.enrolled_countries.set([referential["cm"], ci, sn])
    return {**referential, "ci": ci, "sn": sn, "key": key}


def run(sheets: dict, params=None, sha="", **kw):
    importer = SeatSheetsImporter()
    result = importer.parse(workbook(sheets, **kw))
    return result, importer.apply(result, file_sha256=sha, params=params)


def seats():
    return {(a.planned_session.code_norm, a.country.code): a.seats
            for a in PlannedAllocation.objects.select_related("planned_session", "country")}


TS03 = ["TOYOTA", "TS03 - G3", "Révisions", MAR2, None, "EUGENE", "Douala", 3]


def test_une_session_a_douala_sur_trois_feuilles_donne_un_prevu_et_trois_allocations(world):
    result, log = run({"CAMEROUN": [TS03], "RCI": [TS03[:7] + [2]], "Sénégal": [TS03[:7] + [1]]})

    assert result.ok, result.as_report()
    assert log.report["ignored_sheets"] == ["MOTORS GLOBAL"]
    planned = PlannedSession.objects.get()
    assert (planned.cost_key, planned.country, planned.code_norm) == (
        world["key"], world["cm"], "TS03-G3")
    assert list(planned.trainers.all()) == [world["eugene"]]
    assert seats() == {("TS03-G3", "cm"): 3, ("TS03-G3", "ci"): 2, ("TS03-G3", "sn"): 1}
    assert (log.report["created"], log.report["planned_sessions"]) == (3, 1)


def test_marque_et_code_reportes_ligne_sans_place_ignoree(world):
    result, log = run({"RCI": [
        TS03,
        [None, None, None, MAR9, None, "EUGENE", "Douala", 2],    # code reporté
        [None, None, None, MAR9, None, "LUCIEN GAGNE", "Douala", None],  # sans place
    ]})
    assert result.ok, result.as_report()
    assert log.report["sheets"] == [{"sheet": "RCI", "country": "ci", "seats": 5, "declared": 5}]
    starts = sorted(PlannedSession.objects.values_list("start_date", flat=True))
    assert starts == [MAR2.date(), MAR9.date()]


def test_lieu_vide_le_pays_hote_est_celui_de_la_feuille(world):
    run({"RCI": [["TOYOTA", "TS05", "", MAR2, None, "", "", 4]]})
    assert PlannedSession.objects.get().country == world["ci"]


def test_reimport_idempotent_et_mise_a_jour_des_places(world):
    run({"RCI": [TS03]})
    _, again = run({"RCI": [TS03]})
    assert (again.report["created"], again.report["updated"]) == (0, 0)

    _, changed = run({"RCI": [TS03[:7] + [4]]})
    assert changed.report["updated"] == 1
    assert seats() == {("TS03-G3", "ci"): 4}


def test_aucune_session_realisee_ni_revue_creee(world):
    run({"RCI": [TS03, ["TOYOTA", "TS99", "", MAR9, None, "", "Douala", 1]]})
    assert PlannedSession.objects.count() == 2
    assert not Session.objects.exists()
    assert not SeatAllocation.objects.exists()
    assert not ReviewItem.objects.exists()


def test_l_import_data_ne_touche_pas_au_prevu(world):
    run({"RCI": [TS03]})
    importer = DataSheetImporter()
    log = importer.apply(importer.parse(workbook_bytes([DATA_ROW])))
    assert log.status == "APPLIED"
    assert Session.objects.count() == 1
    assert seats() == {("TS03-G3", "ci"): 3}


def test_total_incoherent_refuse_tout(world):
    result, log = run({"RCI": [TS03, ["TOTAL", None, None, None, None, None, None, 4]]})
    assert [e.code for e in result.errors] == ["TOTAL_MISMATCH"]
    assert log.status == "REJECTED"
    assert not PlannedSession.objects.exists()


def test_meme_session_deux_fois_pour_un_pays_refusee(world):
    result, _ = run({"RCI": [TS03, TS03[:7] + [1]]})
    error = result.errors[0].as_dict()
    assert (error["code"], error["sheet"], error["row"]) == ("DUPLICATE_KEY", "RCI", 3)


def test_lignes_refusees_avec_motif(world):
    result, log = run({"RCI": [
        ["PEUGEOT", "P01", "", MAR2, None, "", "", 1],
        ["TOYOTA", "TS03-G3", "", None, None, "", "", 1],          # MAROC ligne 2 : sans date
        ["TOYOTA", "TS04", "", MAR2, None, "", "Douala Bassa", 1],
        ["TOYOTA", "TS05", "", MAR2, None, "INCONNU", "", 1],
        ["TOYOTA", "TS06", "", dt.datetime(2027, 3, 1), None, "", "", 1],
        ["TOYOTA", "TS07", "", MAR9, MAR2, "", "", 1],
    ]})
    assert [e.code for e in result.errors] == [
        "UNKNOWN_BRAND", "INVALID_DATE", "UNKNOWN_LOCATION", "UNKNOWN_TRAINER", "NO_COST_KEY",
        "END_BEFORE_START",
    ]
    assert "DOUALA" in result.errors[2].message  # suggestion
    assert log.status == "REJECTED"
    assert not PlannedSession.objects.exists()


def test_copies_discordantes_entre_feuilles_refusees(world):
    result, log = run({"CAMEROUN": [TS03], "RCI": [TS03[:5] + ["LUCIEN GAGNE"] + TS03[6:]]})
    error = result.errors[0]
    assert (error.code, error.sheet) == ("PLANNED_CONFLICT", "RCI")
    assert "CAMEROUN" in error.message
    assert log.status == "REJECTED"


def test_replace_sur_cle_draft_supprime_les_absents(world):
    ts99 = ["TOYOTA", "TS99", "", MAR9, None, "", "Douala", 1]
    run({"RCI": [TS03, ts99], "Sénégal": [ts99]})

    _, kept = run({"RCI": [TS03]})
    assert kept.report["missing_from_file"] == [
        {"session": "TS99 09/03/2026 cm (prévu)", "country": "ci", "seats": 1}]
    assert len(seats()) == 3  # sans replace : signalé, pas supprimé

    _, replaced = run({"RCI": [TS03]}, params={"replace": True})
    assert replaced.status == "APPLIED"
    # Le Sénégal n'est pas dans le fichier : sa place sur TS99 reste.
    assert seats() == {("TS03-G3", "ci"): 3, ("TS99", "sn"): 1}

    _, again = run({"RCI": [TS03], "Sénégal": []}, params={"replace": True})
    assert seats() == {("TS03-G3", "ci"): 3}
    assert PlannedSession.objects.count() == 1


@pytest.fixture
def frozen(world):
    sheets = {"CAMEROUN": [TS03], "RCI": [TS03[:7] + [2]]}
    run(sheets, sha="v1")
    freeze(world["key"], "test")
    return sheets


def test_cle_gelee_places_modifiees_rejet_sans_ecriture(world, frozen):
    result, log = run({"CAMEROUN": [TS03], "RCI": [TS03[:7] + [5]]})
    assert (log.status, result.fatal) == ("REJECTED", "KEY_FROZEN")
    assert log.report["frozen_diff"] == {
        "Clé 2026 MOTORS": {"created": [], "updated": ["TS03-G3 02/03/2026"], "missing": []}}
    assert seats() == {("TS03-G3", "cm"): 3, ("TS03-G3", "ci"): 2}


def test_cle_gelee_meme_contenu_autres_octets_no_op(world, frozen):
    _, log = run(frozen, sha="v2", extra_sheet="SYNTHESE")
    assert log.status == "APPLIED"
    assert log.report["frozen_noop"] == ["Clé 2026 MOTORS"]
    assert log.rows_written == 0


def test_cle_gelee_meme_fichier_renvoie_le_journal_precedent(world, frozen):
    first = PlannedSession.objects.get().last_import
    _, log = run(frozen, sha="v1")
    assert log == first


def test_cle_gelee_replace_avec_absent_rejete(world, frozen):
    _, log = run({"CAMEROUN": [TS03], "RCI": []}, params={"replace": True})
    assert log.status == "REJECTED"
    assert log.report["frozen_diff"]["Clé 2026 MOTORS"]["updated"] == ["TS03-G3 02/03/2026"]
    assert len(seats()) == 2


def test_seed_cost_key_idempotent():
    call_command("seed_referential", verbosity=0)
    call_command("seed_cost_key")
    call_command("seed_cost_key")
    key = CostKeyYear.objects.get(year=2026, pole="MOTORS")
    assert CostKeyYear.objects.count() == 1
    assert key.budget == 300_000_000
    assert key.enrolled_countries.count() == 24


def test_seed_cost_key_exige_le_referentiel():
    with pytest.raises(CommandError, match="seed_referential"):
        call_command("seed_cost_key")
