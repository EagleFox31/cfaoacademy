"""Saisie d'une cellule du prévu : contrôles métier, conflits et cohabitation avec l'import."""
import datetime as dt
from decimal import Decimal

import pytest

from planning.models import (
    CostKeyStatus, CostKeyYear, FrozenKeyError, PlannedAllocation, PlannedCellEdit, PlannedSession,
)
from planning.services.cost_key_cells import MISSING, CellConflict, CellGone, CellInvalid, edit_cell
from planning.services.cost_key_freeze import FreezeStale, freeze, last_edit_at

from .test_api_cost_key import POLICY, client_for, fake_pdp  # noqa: F401
from .test_import_seat_sheets import MAR9, TS03, run, seats, workbook, world  # noqa: F401

pytestmark = pytest.mark.django_db

SHEETS = {"CAMEROUN": [TS03], "RCI": [TS03[:7] + [2]]}
TS04 = ["TOYOTA", "TS04 - G1", "Moteur", MAR9, None, "EUGENE", "Douala", 4]


@pytest.fixture
def planned(world):  # noqa: F811
    run(SHEETS)
    session = PlannedSession.objects.get()
    return {**world, "session": session,
            "alloc": session.allocations.get(country=world["cm"]),
            "alloc_ci": session.allocations.get(country=world["ci"])}


def edit_seats(planned, expected, value, actor="u_a", name="Alice", alloc="alloc"):
    return edit_cell(planned["key"].pk, target="allocation", target_id=planned[alloc].pk,
                     field="seats", expected=expected, value=value, actor=actor, actor_name=name)


def edit_session(planned, field, expected, value):
    return edit_cell(planned["key"].pk, target="session", target_id=planned["session"].pk,
                     field=field, expected=expected, value=value, actor="u_a")


def cell_url(key):
    return f"/api/v1/planning/cost-keys/{key.pk}/planned-cells"


def body(planned, expected=3, value=5):
    return {"target": "allocation", "id": str(planned["alloc"].pk), "field": "seats",
            "expected": expected, "value": value}


def freeze_key(key):
    CostKeyYear.objects.filter(pk=key.pk).update(status=CostKeyStatus.FROZEN)


def test_saisie_ecrit_la_valeur_et_journalise_l_auteur(planned):
    result = edit_seats(planned, 3, 5)
    assert result.changed and result.value == 5
    edit = PlannedCellEdit.objects.get()
    assert (edit.old_value, edit.new_value, edit.actor_name, edit.source) == (3, 5, "Alice", "MANUAL")
    assert seats()["TS03-G3", "cm"] == 5


def test_double_envoi_n_ecrit_qu_une_fois(planned):
    edit_seats(planned, 3, 5)
    assert edit_seats(planned, 3, 5).changed is False
    assert PlannedCellEdit.objects.count() == 1


def test_valeur_vue_obligatoire(planned):
    with pytest.raises(CellInvalid):
        edit_seats(planned, MISSING, 5)


def test_conflit_rend_la_valeur_courante_et_son_auteur_sans_rien_ecrire(planned):
    edit_seats(planned, 3, 5)
    with pytest.raises(CellConflict) as exc:
        edit_seats(planned, 3, 7, actor="u_b", name="Bruno")
    details = exc.value.details
    assert (details["expected"], details["current"], details["changed_by"], details["source"]) == (
        3, 5, "Alice", "MANUAL")
    assert seats()["TS03-G3", "cm"] == 5
    assert PlannedCellEdit.objects.count() == 1


def test_remplacer_apres_conflit_repart_de_la_valeur_courante(planned):
    edit_seats(planned, 3, 5)
    assert edit_seats(planned, 5, 7, actor="u_b", name="Bruno").changed
    assert seats()["TS03-G3", "cm"] == 7


def test_ligne_d_une_autre_cle_introuvable(planned):
    other = CostKeyYear.objects.create(year=2027, pole="MOTORS", budget=Decimal(1))
    with pytest.raises(CellGone):
        edit_cell(other.pk, target="allocation", target_id=planned["alloc"].pk, field="seats",
                  expected=3, value=5, actor="u_a")


@pytest.mark.parametrize("target, field", [
    ("session", "country"), ("allocation", "country"),
    ("allocation", "title"), ("autre", "seats"),
])
def test_cellule_hors_liste_refusee(planned, target, field):
    with pytest.raises(CellInvalid):
        edit_cell(planned["key"].pk, target=target, target_id=planned["session"].pk, field=field,
                  expected="", value="x", actor="u_a")


@pytest.mark.parametrize("value", [0, -1, 40000, True, "abc", 2.5, None])
def test_places_invalides(planned, value):
    with pytest.raises(CellInvalid):
        edit_seats(planned, 3, value)
    assert seats()["TS03-G3", "cm"] == 3


def test_fin_avant_debut_refusee_et_fin_videe(planned):
    with pytest.raises(CellInvalid) as exc:
        edit_session(planned, "end_date", None, "2026-03-01")
    assert exc.value.code == "END_BEFORE_START"
    assert edit_session(planned, "end_date", None, "2026-03-06").value == "2026-03-06"
    assert edit_session(planned, "end_date", "2026-03-06", "").value is None


@pytest.mark.parametrize("value, code", [
    ("Abidjan", "LOCATION_HOST_CHANGE"), ("Atlantide", "UNKNOWN_LOCATION"),
])
def test_lieu_controle(planned, value, code):
    with pytest.raises(CellInvalid) as exc:
        edit_session(planned, "location", "Douala", value)
    assert exc.value.code == code


def test_lieu_vide_accepte(planned):
    assert edit_session(planned, "location", "Douala", " ").value == ""


def test_api_droits_et_codes(planned):
    url = cell_url(planned["key"])
    assert client_for("center_assistant").patch(url, body(planned), format="json").status_code == 403
    assert client_for("workshop_manager").patch(url, body(planned), format="json").status_code == 403
    pilot = client_for("training_coordinator")

    r = pilot.patch(url, body(planned), format="json")
    assert r.status_code == 200 and r.json()["changed"] is True and r.json()["value"] == 5

    r = pilot.patch(url, body(planned, 3, 7), format="json")
    error = r.json()["error"]
    assert r.status_code == 409 and error["code"] == "CELL_CONFLICT"
    assert error["details"]["current"] == 5  # entier : le texte casserait « Remplacer »

    missing = {k: v for k, v in body(planned).items() if k != "expected"}
    assert pilot.patch(url, missing, format="json").status_code == 400

    gone = {**body(planned), "id": "00000000-0000-0000-0000-000000000000"}
    assert pilot.patch(url, gone, format="json").json()["error"]["code"] == "CELL_GONE"

    freeze_key(planned["key"])
    r = pilot.patch(url, body(planned, 5, 6), format="json")
    assert r.status_code == 409 and r.json()["error"]["code"] == "KEY_FROZEN"


def test_fiche_pays_porte_le_bloc_d_edition(planned):
    r = client_for("training_coordinator").get(
        f"/api/v1/planning/cost-keys/{planned['key'].pk}/countries/cm")
    edit = r.json()["sessions"][0]["edit"]
    assert edit["allocation"] == str(planned["alloc"].pk)
    assert edit["frozen"] is False
    assert edit["raw"] == {"seats": 3, "start_date": "2026-03-02", "end_date": None,
                           "location": "Douala", "title": "Révisions", "level": ""}


APR6 = dt.datetime(2026, 4, 6)
START, MOVED = "2026-03-02", "2026-04-06"


def dated(start, seats=3):
    return ["TOYOTA", "TS03 - G3", "Révisions", start, None, "EUGENE", "Douala", seats]


def test_debut_saisi_garde_la_date_du_classeur(planned):
    assert edit_session(planned, "start_date", START, MOVED).changed
    edit_session(planned, "start_date", MOVED, "2026-05-04")
    session = PlannedSession.objects.get()
    assert session.start_date == dt.date(2026, 5, 4)
    assert session.file_start_date == dt.date(2026, 3, 2)


@pytest.mark.parametrize("value, code", [
    (None, "START_REQUIRED"), ("2027-01-04", "START_OUTSIDE_YEAR"),
])
def test_debut_invalide_refuse(planned, value, code):
    with pytest.raises(CellInvalid) as exc:
        edit_session(planned, "start_date", START, value)
    assert exc.value.code == code


def test_debut_apres_la_fin_refuse(planned):
    edit_session(planned, "end_date", None, "2026-03-06")
    with pytest.raises(CellInvalid) as exc:
        edit_session(planned, "start_date", START, MOVED)
    assert exc.value.code == "END_BEFORE_START"


def test_debut_deja_pris_par_la_meme_session_refuse(planned):
    run({"CAMEROUN": [TS03, dated(APR6)], "RCI": [TS03[:7] + [2]]})
    with pytest.raises(CellInvalid) as exc:
        edit_session(planned, "start_date", START, MOVED)
    assert exc.value.code == "SESSION_EXISTS"


def test_reimport_retrouve_la_session_deplacee_sans_doublon(planned):
    edit_session(planned, "start_date", START, MOVED)
    result, log = run(SHEETS)
    session = PlannedSession.objects.get()
    assert session.start_date == dt.date(2026, 4, 6)
    assert seats() == {("TS03-G3", "cm"): 3, ("TS03-G3", "ci"): 2}
    assert result.extra["manual_kept"][0]["field"] == "start_date"
    assert log.report["missing_from_file"] == []


def test_remplacement_ne_supprime_pas_la_session_deplacee(planned):
    edit_session(planned, "start_date", START, MOVED)
    run(SHEETS, params={"replace": True})
    assert PlannedSession.objects.get().start_date == dt.date(2026, 4, 6)


def test_classeur_rattrape_la_date_saisie(planned):
    edit_session(planned, "start_date", START, MOVED)
    _, log = run({"CAMEROUN": [dated(APR6)], "RCI": [dated(APR6, 2)]})
    session = PlannedSession.objects.get()
    assert (session.start_moved, session.source_start_date) == (False, None)
    assert log.report["missing_from_file"] == []


def test_ecrasement_remet_la_date_du_classeur(planned):
    edit_session(planned, "start_date", START, MOVED)
    run(SHEETS, params={"overwrite_manual": True})
    session = PlannedSession.objects.get()
    assert (session.start_date, session.start_moved) == (dt.date(2026, 3, 2), False)


def test_import_refuse_si_la_date_saisie_occupe_une_ligne_du_fichier(planned):
    edit_session(planned, "start_date", START, MOVED)
    with pytest.raises(FrozenKeyError):
        run({"CAMEROUN": [TS03, dated(APR6)], "RCI": [TS03[:7] + [2]]})
    assert PlannedSession.objects.count() == 1


def test_session_a_dater_retrouvee_apres_saisie(planned):
    undated = PlannedSession.objects.get()
    PlannedSession.objects.filter(pk=undated.pk).update(start_date=None)
    edit_session(planned, "start_date", None, MOVED)
    assert PlannedSession.objects.get().file_start_date is None


def test_import_conserve_la_saisie_et_la_signale(planned):
    edit_seats(planned, 3, 5)
    result, log = run(SHEETS)
    assert seats()["TS03-G3", "cm"] == 5
    assert result.extra["manual_kept"][0]["file"] == 3
    assert log.report["manual_kept"][0]["current"] == 5


def test_import_met_a_jour_les_cellules_non_saisies_et_le_trace(planned):
    edit_seats(planned, 3, 5)
    run({"CAMEROUN": [TS03[:7] + [9]], "RCI": [TS03[:7] + [8]]})
    assert seats() == {("TS03-G3", "cm"): 5, ("TS03-G3", "ci"): 8}
    trace = PlannedCellEdit.objects.get(source="IMPORT")
    assert (trace.old_value, trace.new_value, trace.target_id) == (2, 8, planned["alloc_ci"].pk)


def test_conflit_apres_import_nomme_l_import(planned):
    run({"CAMEROUN": [TS03[:7] + [9]], "RCI": [TS03[:7] + [2]]})
    with pytest.raises(CellConflict) as exc:
        edit_seats(planned, 3, 5)
    assert exc.value.details["source"] == "IMPORT" and exc.value.details["changed_by"] is None


def test_remplacement_epargne_une_allocation_saisie(planned):
    edit_seats(planned, 2, 6, alloc="alloc_ci")
    run({"CAMEROUN": [TS03], "RCI": [TS04]}, params={"replace": True})
    assert seats()["TS03-G3", "ci"] == 6


def test_ecrasement_explicite_meme_fichier_deja_applique(planned):
    run(SHEETS, sha="abc")
    for value in (5, 6):
        edit_seats(planned, 3, value)
        run(SHEETS, params={"overwrite_manual": True}, sha="abc")
        assert seats()["TS03-G3", "cm"] == 3
    assert PlannedCellEdit.objects.latest("created_at").source == "IMPORT"


def test_cellule_reecrasee_redevient_importable(planned):
    edit_seats(planned, 3, 5)
    run(SHEETS, params={"overwrite_manual": True})
    run({"CAMEROUN": [TS03[:7] + [9]], "RCI": [TS03[:7] + [2]]})
    assert seats()["TS03-G3", "cm"] == 9


def test_ecraser_les_saisies_exige_le_droit_de_saisie(planned, monkeypatch):
    # Aucun rôle n'importe aujourd'hui sans saisir : le contrôle reste prouvé si les droits divergent.
    monkeypatch.setitem(POLICY, "importeur_seul", {"planning_import": {"apply"}})
    payload = {"overwrite_manual": "true"}

    def post(role):
        file = workbook(SHEETS)
        file.name = "cle.xlsx"
        return client_for(role).post("/api/v1/planning/imports/seat_allocations/apply",
                                     {"file": file, **payload}, format="multipart")

    edit_seats(planned, 3, 5)
    assert post("center_assistant").status_code == 403
    assert post("importeur_seul").status_code == 403
    assert seats()["TS03-G3", "cm"] == 5
    assert post("training_coordinator").status_code < 300
    assert seats()["TS03-G3", "cm"] == 3


def test_gel_refuse_sur_un_ecran_perime(planned):
    seen = last_edit_at(planned["key"])
    assert seen is None
    edit_seats(planned, 3, 5)
    with pytest.raises(FreezeStale):
        freeze(planned["key"], actor="u_a", seen_edit_at=seen)
    planned["key"].refresh_from_db()
    assert planned["key"].status != CostKeyStatus.FROZEN
    assert freeze(planned["key"], actor="u_a", seen_edit_at=last_edit_at(planned["key"]))


def test_gel_sans_jeton_garde_son_comportement(planned):
    edit_seats(planned, 3, 5)
    assert freeze(planned["key"], actor="u_a")


def test_journal_immuable(planned):
    edit_seats(planned, 3, 5)
    with pytest.raises(Exception):
        PlannedCellEdit.objects.all().delete()
    with pytest.raises(Exception):
        PlannedCellEdit.objects.update(actor="x")
    assert PlannedAllocation.objects.filter(seats=5).count() == 1
    assert dt.date(2026, 3, 2) == planned["session"].start_date
