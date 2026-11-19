"""Charge des formateurs : jours ouvrés, sessions rapprochées, tri, accès directeur."""
import datetime as dt

import pytest
from rest_framework.test import APIClient

from core.auth.principal import Principal
from planning import views
from planning.models import CostKeyYear, PlannedSession
from planning.services.trainer_load import my_sessions, my_trainer, trainer_load, working_days
from referential.models import Country, Trainer
from referential.normalize import norm_key

pytestmark = pytest.mark.django_db
D = dt.date


def test_jours_ouvres():
    assert working_days(D(2027, 3, 1), D(2027, 3, 5)) == 5      # lundi → vendredi
    assert working_days(D(2027, 3, 4), D(2027, 3, 9)) == 4      # jeudi → mardi, week-end exclu
    assert working_days(D(2027, 3, 1), D(2027, 3, 14)) == 10
    assert working_days(D(2027, 3, 1), None) == 1
    assert working_days(None, None) == 0


@pytest.fixture
def annee(referential):
    keys = {p: CostKeyYear.objects.create(year=2027, pole=p, budget=0) for p in ("MOTORS", "EQUIPMENT")}
    eugene, lucien = referential["eugene"], referential["lucien"]

    def session(code, start, end, trainers, pole="MOTORS"):
        s = PlannedSession.objects.create(
            cost_key=keys[pole], brand=referential["toyota"], code_norm=code,
            country=referential["cm"], start_date=start, end_date=end)
        s.trainers.set(trainers)
        return s

    # Eugène : 3 sessions, les deux premières à 7 jours d'écart, la troisième à 3 semaines.
    session("TS01", D(2027, 3, 1), D(2027, 3, 5), [eugene])
    session("TS02", D(2027, 3, 12), D(2027, 3, 12), [eugene, lucien], pole="EQUIPMENT")
    session("TS03", D(2027, 4, 2), D(2027, 4, 2), [eugene])
    # Lucien : TS02 puis une session 14 jours après la fin (rythme tenu).
    session("TS04", D(2027, 3, 26), D(2027, 3, 26), [lucien])
    session("TS05", D(2027, 5, 3), D(2027, 5, 4), [])
    # Hors périmètre : autre année, externe, technicien instructeur, inactif.
    other = CostKeyYear.objects.create(year=2026, pole="MOTORS", budget=0)
    PlannedSession.objects.create(cost_key=other, brand=referential["toyota"], code_norm="X",
                                  country=referential["cm"], start_date=D(2026, 3, 1))
    Trainer.objects.create(full_name="Ext", name_norm=norm_key("Ext"), service="SAV", is_external=True)
    Trainer.objects.create(full_name="Tech", name_norm=norm_key("Tech"), service="MOTORS",
                           kind=Trainer.Kind.TECH_INSTRUCTOR)
    Trainer.objects.create(full_name="Ancien", name_norm=norm_key("Ancien"), service="MOTORS",
                           is_active=False)
    return referential


def test_charge_par_formateur(annee):
    data = trainer_load(2027, today=D(2027, 3, 10))
    assert data["sessions"] == 5 and data["unassigned_sessions"] == 1
    assert [t["name"] for t in data["trainers"]] == ["Eugène EBENE", "Lucien GAGNE"]
    eugene, lucien = data["trainers"]
    assert (eugene["days"], eugene["sessions_count"], eugene["close_sessions"]) == (7, 3, 2)
    assert [s["close"] for s in eugene["sessions"]] == [True, True, False]
    assert eugene["next_session"] == {"start_date": D(2027, 3, 12), "country": "cm",
                                      "country_label": "Cameroun"}
    assert (lucien["days"], lucien["sessions_count"], lucien["close_sessions"]) == (2, 2, 0)
    assert eugene["service_label"] == "Motors"


def test_formateur_sans_session_reste_liste(referential):
    data = trainer_load(2027)
    assert [(t["sessions_count"], t["next_session"]) for t in data["trainers"]] == [(0, None), (0, None)]


def test_mes_sessions_a_venir_seulement(annee):
    eugene = annee["eugene"]
    eugene.keycloak_sub = "sub-eugene"
    eugene.save(update_fields=["keycloak_sub"])
    data = my_sessions("sub-eugene", today=D(2027, 3, 5))
    assert data["linked"] is True
    # TS01 finit le 5 mars : encore en cours ce jour-là. TS02 partagée avec Lucien.
    assert [s["code"] for s in data["sessions"]] == ["TS01", "TS02", "TS03"]
    assert {"location", "delivery_mode", "brand", "start_date"} <= set(data["sessions"][0])
    assert [s["code"] for s in my_sessions("sub-eugene", today=D(2027, 3, 6))["sessions"]] == ["TS02", "TS03"]


def test_mes_sessions_compte_non_relie(annee):
    assert my_sessions("inconnu") == {"linked": False, "sessions": []}
    assert my_sessions("") == {"linked": False, "sessions": []}


def test_endpoint_mes_sessions(annee, monkeypatch):
    seen = {}

    def check(p, kind, rid, attr, action):
        seen.update(kind=kind, rid=rid, attr=attr)
        return kind == "planning_my_sessions" and attr["ownerSub"] == p["id"]
    monkeypatch.setattr(views.cerbos, "check", check)
    annee["eugene"].keycloak_sub = "u_trainer"
    annee["eugene"].save(update_fields=["keycloak_sub"])
    res = _client("trainer").get("/api/v1/planning/me/sessions")
    assert res.status_code == 200 and res.json()["linked"] is True
    assert seen == {"kind": "planning_my_sessions", "rid": "u_trainer",
                    "attr": {"ownerSub": "u_trainer", "orgPath": ["groupe"]}}
    monkeypatch.setattr(views.cerbos, "check", lambda *a: False)
    assert _client("training_coordinator").get("/api/v1/planning/me/sessions").status_code == 403


def test_ma_fiche_pays_et_marques(referential):
    lucien, eugene = referential["lucien"], referential["eugene"]
    lucien.keycloak_sub, lucien.home_country = "sub-lucien", referential["cm"]
    lucien.save(update_fields=["keycloak_sub", "home_country"])
    lucien.brands.set([referential["omoda"], referential["toyota"]])
    data = my_trainer("sub-lucien")
    assert data == {"linked": True, "trainer": {
        "name": "Lucien GAGNE", "country": {"code": "cm", "label": "Cameroun"},
        "brands": [{"code": "omoda-jaecoo", "label": "OMODA & JAECOO"},
                   {"code": "toyota", "label": "TOYOTA"}]}}
    # Sans pays sur la fiche : l'Academy (Cameroun).
    Country.objects.create(code="cmr", label="Cameroun", org_path=["groupe", "groupe.cmr"])
    eugene.keycloak_sub = "sub-eugene"
    eugene.save(update_fields=["keycloak_sub"])
    assert my_trainer("sub-eugene")["trainer"]["country"] == {"code": "cmr", "label": "Cameroun"}
    assert my_trainer("sub-eugene")["trainer"]["brands"] == []


def test_ma_fiche_compte_non_relie(referential):
    assert my_trainer("inconnu") == {"linked": False, "trainer": None}
    assert my_trainer("") == {"linked": False, "trainer": None}


def test_endpoint_ma_fiche(referential, monkeypatch):
    seen = {}

    def check(p, kind, rid, attr, action):
        seen.update(kind=kind, rid=rid, attr=attr)
        return kind == "planning_my_trainer" and attr["ownerSub"] == p["id"]
    monkeypatch.setattr(views.cerbos, "check", check)
    res = _client("trainer").get("/api/v1/planning/me/trainer")
    assert res.status_code == 200 and res.json() == {"linked": False, "trainer": None}
    assert seen == {"kind": "planning_my_trainer", "rid": "u_trainer",
                    "attr": {"ownerSub": "u_trainer", "orgPath": ["groupe"]}}
    monkeypatch.setattr(views.cerbos, "check", lambda *a: False)
    assert _client("training_coordinator").get("/api/v1/planning/me/trainer").status_code == 403


def _client(role):
    c = APIClient()
    c.force_authenticate(user=Principal(id=f"u_{role}", roles=[role], display_name=role,
                                        attr={"scopeNodes": ["cfao"], "locale": "fr"}))
    return c


def test_endpoint_reserve_au_directeur(annee, monkeypatch):
    monkeypatch.setattr(views.cerbos, "check", lambda p, kind, rid, attr, action:
                        kind == "planning_trainer_load" and "center_director" in p["roles"])
    url = "/api/v1/planning/years/2027/trainer-load"
    assert _client("training_coordinator").get(url).status_code == 403
    res = _client("center_director").get(url)
    assert res.status_code == 200
    assert res.json()["trainers"][0]["sessions"][0]["start_date"] == "2027-03-01"
