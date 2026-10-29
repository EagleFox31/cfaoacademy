"""Contrat consommateur : cfao-core -> needs-analytics (contracts/registry.json).

Chaque appel HTTP de `analytics.services` est confronté à la spec publiée par
cfao-needs, et la réponse simulée est l'exemple de cette spec. Un champ
renommé côté needs fait échouer ce test au lieu de s'afficher en 0 sur le
tableau de bord.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "contracts"))

import kit  # noqa: E402

from analytics import services  # noqa: E402

BASE = "http://needs.test"
SPEC = kit.load_spec("needs-analytics")


class _Response:
    def __init__(self, payload: dict):
        self.status_code = 200
        self._payload = payload

    def json(self) -> dict:
        return self._payload


@pytest.fixture
def calls(monkeypatch, settings):
    settings.NEEDS_API_URL = BASE
    settings.NEEDS_ANALYTICS_KEY = "contract-test-key"
    seen: list[dict] = []

    def fake_get(url, params=None, headers=None, timeout=None):
        assert url.startswith(BASE), url
        path = url[len(BASE):]
        assert kit.request_errors(SPEC, path, params, headers) == []
        seen.append({"path": path, "params": params})
        return _Response(kit.response_example(SPEC, path))

    monkeypatch.setattr(services.requests, "get", fake_get)
    for cached in (services.count_technicians, services.fetch_allocations_per_branch, services.count_scheduled_trainings):
        cached.cache_clear()
    yield seen
    for cached in (services.count_technicians, services.fetch_allocations_per_branch, services.count_scheduled_trainings):
        cached.cache_clear()


def test_examples_are_valid_responses():
    for path in SPEC["paths"]:
        assert list(kit.response_validator(SPEC, path, 200).iter_errors(kit.response_example(SPEC, path))) == []


@pytest.mark.parametrize("bu", ["equipment", "motors", "all"])
def test_count_technicians(calls, bu):
    example = kit.response_example(SPEC, "/api/v1/needs/analytics/total-technicians")
    assert services.count_technicians(bu) == example["count"]
    assert calls[0]["path"] == "/api/v1/needs/analytics/total-technicians"


def test_fetch_allocations_per_branch(calls):
    example = kit.response_example(SPEC, "/api/v1/needs/analytics/allocations-per-branch")
    assert services.fetch_allocations_per_branch(2026) == example["allocations"]


def test_count_scheduled_trainings(calls):
    example = kit.response_example(SPEC, "/api/v1/needs/analytics/scheduled-trainings")
    assert services.count_scheduled_trainings(2026) == example["count"]


def test_every_consumed_route_is_exercised(calls):
    services.count_technicians("all")
    services.fetch_allocations_per_branch(2026)
    services.count_scheduled_trainings(2026)
    assert {call["path"] for call in calls} == set(SPEC["paths"])
