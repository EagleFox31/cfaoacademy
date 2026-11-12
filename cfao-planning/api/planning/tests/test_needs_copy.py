"""Copie locale des besoins : push du relais de cfao-needs, rattrapage, lectures.

Le changement de pôle à l'écran lit la copie : aucun appel à cfao-needs tant
qu'elle est fraîche, et des données datées (jamais vides) si needs est arrêté.
"""
import copy
import sys
from pathlib import Path

import pytest
import requests
from django.core.management import call_command
from rest_framework.test import APIClient

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "contracts"))

import kit  # noqa: E402

from planning import contract  # noqa: E402
from planning.clients import needs as client  # noqa: E402
from planning.models import NeedsCopyState, NeedsCopyYear  # noqa: E402
from planning.services.needs_copy import PULL, PUSH, SnapshotInvalid, apply_snapshot  # noqa: E402

pytestmark = pytest.mark.django_db
PUSH_URL = "/api/v1/planning/internal/needs-snapshot"
NEEDS_SPEC = kit.load_spec("needs-analytics")
PUSH_SPEC = kit.load_spec("needs-snapshot-push")


def _snapshot(version=42, years=("2026",)):
    example = kit.response_example(NEEDS_SPEC, client.SNAPSHOT)
    doc = copy.deepcopy(example)
    doc["version"] = version
    doc["years"] = {y: copy.deepcopy(example["years"]["2026"]) for y in years}
    return doc


class _Response:
    def __init__(self, payload=None, status_code=200):
        self.status_code, self._payload = status_code, payload

    def json(self):
        return self._payload


class _Needs:
    """Faux cfao-needs : compte les appels, répond le snapshot ou une panne."""

    def __init__(self):
        self.calls, self.headers, self.reply = 0, [], lambda: _Response(_snapshot())

    def __call__(self, url, params=None, headers=None, timeout=None):
        self.calls += 1
        self.headers.append(headers)
        return self.reply()


@pytest.fixture
def needs(monkeypatch, settings):
    settings.NEEDS_API_URL, settings.NEEDS_ANALYTICS_KEY = "http://needs.test", "k"
    client.reset_refresh_clock()
    fake = _Needs()
    monkeypatch.setattr(client.requests, "get", fake)
    return fake


# ── Contrat publié ────────────────────────────────────────────────────────────

def test_published_contract_is_the_generated_one():
    assert contract.CONTRACT_PATH.read_text(encoding="utf-8") == contract.render()


def test_needs_example_is_a_valid_push_body():
    errors = kit.request_body_validator(PUSH_SPEC, PUSH_URL).iter_errors(_snapshot())
    assert [e.message for e in errors] == []


# ── Règles d'application ──────────────────────────────────────────────────────

def test_push_applies_only_a_newer_version():
    assert apply_snapshot(_snapshot(5), PUSH) is True
    assert apply_snapshot(_snapshot(5), PUSH) is False  # rejeu : zéro écriture
    assert apply_snapshot(_snapshot(4), PUSH) is False  # message en retard : jamais de recul
    assert NeedsCopyState.objects.get(pk=1).version == 5


def test_pull_follows_needs_even_backwards():
    apply_snapshot(_snapshot(5), PUSH)
    assert apply_snapshot(_snapshot(5), PULL) is False
    assert apply_snapshot(_snapshot(3), PULL) is True  # base needs restaurée : needs a raison
    assert NeedsCopyState.objects.get(pk=1).version == 3


def test_years_absent_from_the_snapshot_are_removed():
    apply_snapshot(_snapshot(1, years=("2026", "2027")), PUSH)
    apply_snapshot(_snapshot(2, years=("2027",)), PUSH)
    assert list(NeedsCopyYear.objects.values_list("year", flat=True)) == [2027]


@pytest.mark.parametrize("broken", [
    lambda d: d.pop("version"),
    lambda d: d.update(version=True),
    lambda d: d.update(generated_at="hier"),
    lambda d: d["years"].update(abc={}),
    lambda d: d["years"]["2026"]["needs_by_branch_brand"].pop("equipment"),
    lambda d: d["years"]["2026"]["needs_by_branch_brand"]["motors"]["rows"].append({"country": "X"}),
    lambda d: d["years"]["2026"]["catalog_levels"].pop("lines"),
])
def test_invalid_document_writes_nothing(broken):
    apply_snapshot(_snapshot(1), PUSH)
    doc = _snapshot(2)
    broken(doc)
    with pytest.raises(SnapshotInvalid):
        apply_snapshot(doc, PUSH)
    assert NeedsCopyState.objects.get(pk=1).version == 1


# ── Point d'entrée du relais ──────────────────────────────────────────────────

@pytest.fixture
def api(settings):
    settings.NEEDS_SNAPSHOT_INBOUND_KEY = "inbound"
    return APIClient()


def test_push_endpoint_refuses_a_wrong_or_missing_key(api, settings):
    assert api.post(PUSH_URL, _snapshot(), format="json").status_code == 403
    assert api.post(PUSH_URL, _snapshot(), format="json", HTTP_X_NEEDS_SNAPSHOT_KEY="x").status_code == 403
    settings.NEEDS_SNAPSHOT_INBOUND_KEY = ""  # clé non configurée : fermé, jamais ouvert
    assert api.post(PUSH_URL, _snapshot(), format="json", HTTP_X_NEEDS_SNAPSHOT_KEY="").status_code == 403
    assert NeedsCopyState.objects.get(pk=1).version is None


def test_push_endpoint_applies_then_is_idempotent(api):
    first = api.post(PUSH_URL, _snapshot(7), format="json", HTTP_X_NEEDS_SNAPSHOT_KEY="inbound")
    again = api.post(PUSH_URL, _snapshot(7), format="json", HTTP_X_NEEDS_SNAPSHOT_KEY="inbound")
    validator = kit.response_validator(PUSH_SPEC, PUSH_URL, 200, method="post")
    assert first.status_code == 200 and first.json() == {"applied": True, "version": 7}
    assert again.json() == {"applied": False, "version": 7}
    assert list(validator.iter_errors(first.json())) == []


def test_push_endpoint_rejects_an_invalid_document(api):
    response = api.post(PUSH_URL, {"version": 1}, format="json", HTTP_X_NEEDS_SNAPSHOT_KEY="inbound")
    assert response.status_code == 400
    assert NeedsCopyState.objects.get(pk=1).version is None


# ── Lectures sur la copie ─────────────────────────────────────────────────────

def test_fresh_copy_is_read_without_calling_needs(needs, settings):
    settings.NEEDS_SNAPSHOT_RECHECK_S = 300
    client.fetch_needs(2026, "MOTORS")  # premier passage : rattrapage
    for pole in ("MOTORS", "EQUIPMENT", "MOTORS", "EQUIPMENT"):
        client.fetch_needs(2026, pole)
        client.fetch_unchosen(2026, pole)
    client.fetch_catalog_levels(2026)
    assert needs.calls == 1


def test_recheck_sends_the_known_version_and_handles_304(needs, settings):
    settings.NEEDS_SNAPSHOT_RECHECK_S = 0
    client.fetch_needs(2026, "MOTORS")
    needs.reply = lambda: _Response(None, 304)
    data = client.fetch_needs(2026, "MOTORS")
    assert needs.headers[-1]["If-None-Match"] == '"v42"'
    assert data.available and "needs_snapshot_stale" not in {w["code"] for w in data.warnings}


def test_needs_down_with_a_copy_gives_dated_data(needs, settings):
    apply_snapshot(_snapshot(42), PUSH)
    settings.NEEDS_SNAPSHOT_RECHECK_S = 0

    def down():
        raise requests.ConnectionError("needs arrêté")

    needs.reply = down
    data = client.fetch_needs(2026, "MOTORS")
    assert data.available
    assert data.warnings[0] == {"code": "needs_snapshot_stale",
                                "value": NeedsCopyState.objects.get(pk=1).generated_at.isoformat()}


def test_unknown_year_in_the_copy_is_empty_not_unavailable(needs):
    apply_snapshot(_snapshot(42), PUSH)
    assert client.fetch_needs(2031, "MOTORS").available is True
    assert client.fetch_unchosen(2031, "MOTORS")["modules"] == []


def test_sync_command_never_fails_the_migrate_job(needs, capsys):
    needs.reply = lambda: _Response(None, 503)
    call_command("sync_needs_snapshot")
    assert "unavailable" in capsys.readouterr().out
    needs.reply = lambda: _Response(_snapshot(9))
    call_command("sync_needs_snapshot")
    call_command("sync_needs_snapshot")  # second passage : déjà à jour
    assert NeedsCopyState.objects.get(pk=1).version == 9


def test_level_change_refreshes_the_copy_at_once(needs, monkeypatch, settings):
    settings.NEEDS_CATALOG_WRITE_KEY = "w"
    apply_snapshot(_snapshot(1), PUSH)
    needs.reply = lambda: _Response(_snapshot(2))
    monkeypatch.setattr(client.requests, "post",
                        lambda *a, **k: _Response({"changed": True, "level_label": "G3", "lines": []}))
    client.update_catalog_level(("a",), "G4", "G3")
    assert NeedsCopyState.objects.get(pk=1).version == 2
