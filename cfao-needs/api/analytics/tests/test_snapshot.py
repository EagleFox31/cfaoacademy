"""Snapshot des besoins (/analytics/snapshot) et relais vers cfao-planning."""
from datetime import timedelta

import pytest
import requests
from django.utils import timezone
from rest_framework.test import APIClient

from analytics import relay
from analytics.models import NeedsOutbox, NeedsState
from analytics.snapshot import build_snapshot
from analytics.tests.test_contract import _validator
from analytics.tests.test_views import _catalog, _submission
from campaigns.models import BranchBrandQuota, Campaign, NeedLine
from referential.models import Brand

KEY = "snapshot-test-key"
URL = "/api/v1/needs/analytics/snapshot"


@pytest.fixture
def client(settings):
    settings.ANALYTICS_INBOUND_KEY = KEY
    return APIClient(HTTP_X_ANALYTICS_KEY=KEY)


@pytest.fixture
def world(db):
    campaign = Campaign.objects.create(year=2027, label="2027")
    toyota = Brand.objects.create(code="toyota", label="Toyota", pole="MOBILITY")
    line = _catalog(campaign, "TS01", toyota)
    NeedLine.objects.create(submission=_submission(campaign, "BENIN"), catalog_line=line, q1=3, postponed=1)
    BranchBrandQuota.objects.create(campaign=campaign, pole="MOTORS", country="BENIN", brand="Toyota",
                                    brand_tech_count=4)
    return campaign


def test_snapshot_gives_every_year_and_pole_with_the_bodies_of_the_reads(client, world):
    body = client.get(URL).json()
    year = body["years"]["2027"]
    assert set(year["needs_by_branch_brand"]) == {"motors", "equipment", "all"}
    one = client.get("/api/v1/needs/analytics/needs-by-branch-brand", {"year": 2027, "pole": "motors"}).json()
    assert year["needs_by_branch_brand"]["motors"] == one
    assert year["catalog_levels"]["lines"][0]["code"] == "TS01"
    assert body["version"] == 0  # SQLite : pas de trigger, la version ne bouge pas


def test_snapshot_matches_the_published_contract(client, world):
    response = client.get(URL)
    assert list(_validator(URL, 200).iter_errors(response.json())) == []


def test_snapshot_answers_304_when_the_version_is_known(client, world):
    NeedsState.objects.create(pk=1, version=7)
    first = client.get(URL)
    assert first["ETag"] == '"v7"' and first.json()["version"] == 7
    again = client.get(URL, HTTP_IF_NONE_MATCH='"v7"')
    assert again.status_code == 304 and not again.content
    stale = client.get(URL, HTTP_IF_NONE_MATCH='"v6"')
    assert stale.status_code == 200


def test_snapshot_refuses_without_key(world):
    assert APIClient().get(URL).status_code == 403


# ── Relais ────────────────────────────────────────────────────────────────────

class _Reply:
    def __init__(self, status):
        self.status_code = status


class _Planning:
    """Faux cfao-planning : note chaque envoi et répond `status`."""

    def __init__(self):
        self.status, self.sent = 200, []

    def __call__(self, url, json=None, headers=None, timeout=None):
        self.sent.append({"url": url, "version": json["version"], "key": headers["X-Needs-Snapshot-Key"]})
        return _Reply(self.status)


@pytest.fixture
def pushing(settings, world):
    settings.PLANNING_API_URL, settings.NEEDS_SNAPSHOT_PUSH_KEY = "http://planning.test", "push"
    return _Planning()


def _outbox(version, **extra):
    """Ce que fait le trigger Postgres : la version courante avance avec l'outbox."""
    now = timezone.now()
    NeedsState.objects.update_or_create(pk=1, defaults={"version": version})
    return NeedsOutbox.objects.create(version=version, created_at=now, next_attempt_at=now, **extra)


def test_relay_sends_one_snapshot_for_all_pending_versions(monkeypatch, pushing):
    monkeypatch.setattr(relay.requests, "post", pushing)
    for v in (1, 2, 3):
        _outbox(v)
    assert relay.deliver_pending() == "delivered"
    assert pushing.sent == [{"url": "http://planning.test/api/v1/planning/internal/needs-snapshot",
                             "version": 3, "key": "push"}]
    assert not NeedsOutbox.objects.filter(delivered_at__isnull=True).exists()
    assert relay.deliver_pending() == "idle"  # rien de neuf : aucun envoi


def test_relay_body_matches_the_planning_contract(monkeypatch, pushing):
    """Contrat consommateur `needs-snapshot-push` : ce que le relais envoie, planning l'accepte."""
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "contracts"))
    import kit

    spec = kit.load_spec("needs-snapshot-push")
    sent = []

    def post(url, json=None, headers=None, timeout=None):
        path = url[len("http://planning.test"):]
        assert kit.request_errors(spec, path, None, headers, method="post") == []
        assert [e.message for e in kit.request_body_validator(spec, path).iter_errors(json)] == []
        sent.append(json["version"])
        return _Reply(200)

    monkeypatch.setattr(relay.requests, "post", post)
    _outbox(1)
    assert relay.deliver_pending() == "delivered" and sent == [1]


def test_relay_backs_off_and_retries(monkeypatch, pushing):
    monkeypatch.setattr(relay.requests, "post", pushing)
    pushing.status = 503
    _outbox(1)
    now = timezone.now()
    assert relay.deliver_pending(now) == "failed"
    row = NeedsOutbox.objects.get()
    assert row.attempts == 1 and row.last_error == "HTTP 503"
    assert row.next_attempt_at == now + timedelta(seconds=5)
    assert relay.deliver_pending(now + timedelta(seconds=1)) == "idle"  # pas encore dû
    assert relay.deliver_pending(now + timedelta(seconds=6)) == "failed"
    assert NeedsOutbox.objects.get().next_attempt_at == now + timedelta(seconds=16)  # 6 + 10
    pushing.status = 200
    assert relay.deliver_pending(now + timedelta(seconds=20)) == "delivered"


def test_relay_survives_planning_down(monkeypatch, pushing):
    def down(*a, **k):
        raise requests.ConnectionError("refused")
    monkeypatch.setattr(relay.requests, "post", down)
    _outbox(1)
    assert relay.deliver_pending() == "failed"
    assert NeedsOutbox.objects.get().last_error == "unreachable: ConnectionError"


def test_relay_backoff_is_capped(settings):
    settings.NEEDS_RELAY_MAX_BACKOFF_S = 600
    assert [relay.backoff(n).seconds for n in (1, 2, 3, 20)] == [5, 10, 20, 600]


def test_relay_without_configuration_sends_nothing(monkeypatch, settings, world):
    settings.PLANNING_API_URL = ""
    monkeypatch.setattr(relay.requests, "post", lambda *a, **k: pytest.fail("envoi inattendu"))
    _outbox(1)
    assert relay.deliver_pending() == "disabled"


def test_relay_forgets_old_rows(world):
    old = timezone.now() - timedelta(days=31)
    NeedsOutbox.objects.create(version=1, created_at=old, next_attempt_at=old, delivered_at=old)
    assert relay.deliver_pending() == "idle"
    assert not NeedsOutbox.objects.exists()


def test_build_snapshot_has_a_version_and_a_date(world):
    snap = build_snapshot()
    assert snap["version"] == 0 and snap["generated_at"] and list(snap["years"]) == ["2027"]
