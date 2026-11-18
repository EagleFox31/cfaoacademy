"""Charge des formateurs : jours ouvrés, sessions rapprochées, tri, accès directeur."""
import datetime as dt

import pytest
from rest_framework.test import APIClient

from core.auth.principal import Principal
from planning import views
from planning.models import CostKeyYear, PlannedSession
from planning.services.trainer_load import trainer_load, working_days
from referential.models import Trainer
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
