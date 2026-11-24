"""Contrat fournisseur `cr-sessions` : sessions à documenter, lues par le module Comptes rendus."""
import datetime as dt
import sys
from pathlib import Path

import pytest
from rest_framework.test import APIClient

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "contracts"))

import kit  # noqa: E402

from planning import contract_cr  # noqa: E402
from planning.models import CostKeyYear, PlannedSession  # noqa: E402
from planning.services.cr_sessions import sessions_to_document  # noqa: E402

pytestmark = pytest.mark.django_db
D = dt.date
URL = contract_cr.PATH
KEY = "cr-test-key"
SPEC = kit.load_spec("cr-sessions")


@pytest.fixture
def sessions(referential, settings):
    settings.CR_SESSIONS_KEY = KEY
    key = CostKeyYear.objects.create(year=2026, pole="MOTORS", budget=0)
    eugene, lucien = referential["eugene"], referential["lucien"]
    eugene.keycloak_sub = "sub-eugene"
    eugene.save()

    def session(code, start, end, trainers):
        s = PlannedSession.objects.create(cost_key=key, brand=referential["toyota"], code_norm=code,
                                          country=referential["cm"], start_date=start, end_date=end)
        s.trainers.set(trainers)
        return s

    return {
        "finie": session("TS01", D(2026, 11, 2), D(2026, 11, 6), [eugene, lucien]),
        "un_jour": session("TS02", D(2026, 11, 20), None, [lucien]),
        "ancienne": session("TS03", D(2026, 8, 3), D(2026, 8, 7), [eugene]),
        "a_venir": session("TS04", D(2026, 11, 23), D(2026, 11, 27), [eugene]),
        "sans_date": PlannedSession.objects.create(cost_key=key, brand=referential["toyota"],
                                                   code_norm="TS05", country=referential["cm"]),
    }


def _get(params=None, key=KEY, etag=None):
    headers = {"HTTP_X_CR_SESSIONS_KEY": key} if key else {}
    if etag:
        headers["HTTP_IF_NONE_MATCH"] = etag
    return APIClient().get(URL, params or {}, **headers)


@pytest.fixture
def today(monkeypatch):
    """Aujourd'hui figé au 20/11/2026 pour la vue."""
    from planning.services import cr_sessions

    monkeypatch.setattr(cr_sessions, "_today", lambda: D(2026, 11, 20))


# ── Contrat publié ────────────────────────────────────────────────────────────

def test_published_contract_is_the_generated_one():
    assert contract_cr.CONTRACT_PATH.read_text(encoding="utf-8") == contract_cr.render()


def test_spec_example_is_valid():
    errors = kit.response_validator(SPEC, URL, 200).iter_errors(kit.response_example(SPEC, URL))
    assert [e.message for e in errors] == []


# ── Règles de lecture ─────────────────────────────────────────────────────────

def test_only_sessions_ended_in_the_window(sessions):
    data = sessions_to_document(days=60, today=D(2026, 11, 20))
    assert [s["code"] for s in data["sessions"]] == ["TS01", "TS02"]  # par date de fin
    assert data["window"] == {"ended_from": "2026-09-21", "ended_to": "2026-11-20"}
    one_day = data["sessions"][1]
    assert one_day["end_date"] == one_day["start_date"] == "2026-11-20" and one_day["days"] == 1
    assert sessions_to_document(days=120, today=D(2026, 11, 20))["sessions"][0]["code"] == "TS03"


def test_trainer_filter_by_account(sessions):
    codes = lambda sub: [s["code"] for s in sessions_to_document(60, sub, D(2026, 11, 20))["sessions"]]  # noqa: E731
    assert codes("sub-eugene") == ["TS01"]
    assert codes("compte-non-relie") == []
    trainers = sessions_to_document(60, today=D(2026, 11, 20))["sessions"][0]["trainers"]
    assert [(t["name"], t["sub"]) for t in trainers] == [("Eugène EBENE", "sub-eugene"), ("Lucien GAGNE", None)]


@pytest.mark.parametrize("trainer_sub", [None, "sub-eugene"])
def test_query_count_does_not_grow_with_sessions(sessions, referential, django_assert_num_queries,
                                                 trainer_sub):
    """Deux requêtes (sessions + formateurs), quel que soit le nombre de sessions : pas de N+1."""
    key = CostKeyYear.objects.get(year=2026, pole="MOTORS")
    for i in range(12):
        s = PlannedSession.objects.create(cost_key=key, brand=referential["toyota"], code_norm=f"TN{i:02}",
                                          country=referential["cm"], start_date=D(2026, 11, 9),
                                          end_date=D(2026, 11, 13))
        s.trainers.set([referential["eugene"], referential["lucien"]])
    with django_assert_num_queries(2):
        data = sessions_to_document(60, trainer_sub, D(2026, 11, 20))
    assert len(data["sessions"]) == (13 if trainer_sub else 14)


def test_revision_follows_content(sessions):
    before = sessions_to_document(60, today=D(2026, 11, 20))
    assert sessions_to_document(60, today=D(2026, 11, 20)) == before  # stable
    sessions["finie"].trainers.remove(sessions["finie"].trainers.get(full_name="Lucien GAGNE"))
    after = sessions_to_document(60, today=D(2026, 11, 20))
    assert after["revision"] != before["revision"]
    assert after["sessions"][0]["revision"] != before["sessions"][0]["revision"]
    assert after["sessions"][1]["revision"] == before["sessions"][1]["revision"]  # l'autre ne bouge pas


# ── Point d'entrée ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("key", [None, "mauvaise-cle"])
def test_key_required(sessions, key):
    response = _get(key=key)
    assert response.status_code == 403
    assert [e.message for e in kit.response_validator(SPEC, URL, 403).iter_errors(response.json())] == []


def test_no_key_configured_refuses_everything(sessions, settings):
    settings.CR_SESSIONS_KEY = ""
    assert _get(key="").status_code == 403
    assert _get(key="n-importe-quoi").status_code == 403


@pytest.mark.parametrize("days", ["0", "401", "abc"])
def test_invalid_days(sessions, days):
    response = _get({"days": days})
    assert response.status_code == 400
    assert [e.message for e in kit.response_validator(SPEC, URL, 400).iter_errors(response.json())] == []


def test_response_matches_spec_and_conditional_get(sessions, today):
    assert kit.request_errors(SPEC, URL, {"days": 60, "trainer": "sub-eugene"},
                              {"X-Cr-Sessions-Key": KEY}) == []
    response = _get({"days": "60"})
    assert response.status_code == 200
    body = response.json()
    assert [e.message for e in kit.response_validator(SPEC, URL, 200).iter_errors(body)] == []
    assert response["ETag"] == f'"{body["revision"]}"'

    unchanged = _get({"days": "60"}, etag=response["ETag"])
    assert unchanged.status_code == 304 and not unchanged.content
    assert unchanged["ETag"] == response["ETag"]

    sessions["un_jour"].location = "Douala"
    sessions["un_jour"].save()
    assert _get({"days": "60"}, etag=response["ETag"]).status_code == 200
