"""Trigger de version des besoins (Postgres seulement : `--ds=config.settings.test_pg`).

Chaque transaction qui change une donnée lue par le snapshot crée UNE version,
une ligne d'outbox et un NOTIFY ; une écriture sans effet n'en crée aucune.
"""
import psycopg
import pytest
from django.db import connection, transaction
from django.utils import timezone

from analytics.models import NeedsOutbox, NeedsState
from analytics.snapshot import build_snapshot
from analytics.tests.test_views import _catalog, _submission
from campaigns.models import BranchBrandQuota, Campaign, NeedLine, Submission
from referential.models import Brand

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def _postgres_only():
    if connection.vendor != "postgresql":
        pytest.skip("trigger Postgres : lancer avec --ds=config.settings.test_pg")


def _version() -> int:
    state = NeedsState.objects.filter(pk=1).first()
    return state.version if state else 0


@pytest.fixture
def world():
    campaign = Campaign.objects.create(year=2027, label="2027")
    toyota = Brand.objects.create(code="toyota", label="Toyota", pole="MOBILITY")
    line = _catalog(campaign, "TS01", toyota)
    submission = _submission(campaign, "BENIN", Submission.Status.SUBMITTED)
    need = NeedLine.objects.create(submission=submission, catalog_line=line, q1=3)
    quota = BranchBrandQuota.objects.create(campaign=campaign, pole="MOTORS", country="BENIN", brand="Toyota",
                                            brand_tech_count=4)
    return {"line": line, "submission": submission, "need": need, "quota": quota, "brand": toyota}


@pytest.mark.parametrize("change", [
    pytest.param(lambda w: setattr(w["submission"], "status", Submission.Status.VALIDATED) or w["submission"], id="validation"),
    pytest.param(lambda w: setattr(w["need"], "postponed", 2) or w["need"], id="report"),
    pytest.param(lambda w: setattr(w["need"], "q4", 1) or w["need"], id="quantite"),
    pytest.param(lambda w: setattr(w["line"], "tier", "SENIOR") or w["line"], id="palier"),
    pytest.param(lambda w: setattr(w["line"], "level_label", "G3") or w["line"], id="niveau"),
    pytest.param(lambda w: setattr(w["quota"], "brand_tech_count", 9) or w["quota"], id="effectif"),
    pytest.param(lambda w: setattr(w["brand"], "label", "TOYOTA") or w["brand"], id="marque"),
])
def test_each_read_change_makes_one_version(world, change):
    before = _version()
    change(world).save()
    assert _version() == before + 1
    assert NeedsOutbox.objects.filter(version=before + 1, delivered_at__isnull=True).count() == 1


def test_save_without_change_or_on_unread_column_makes_nothing(world):
    before = _version()
    world["need"].save()  # aucun changement
    world["submission"].last_activity_at = timezone.now()
    world["submission"].save()  # colonne que le snapshot ne lit pas
    world["line"].title_en = "Engine"
    world["line"].save()
    assert _version() == before
    assert NeedsOutbox.objects.count() == before


def test_one_transaction_makes_one_version_whatever_the_rows(world):
    before = _version()
    with transaction.atomic():
        for q in (1, 2, 3):
            world["need"].q2 = q
            world["need"].save()
        NeedLine.objects.create(submission=world["submission"], catalog_line=_catalog(
            world["line"].campaign, "TS02", world["brand"]), q1=1)
        world["submission"].delete()
    assert _version() == before + 1


def test_rolled_back_transaction_makes_nothing(world):
    before = _version()
    with pytest.raises(RuntimeError), transaction.atomic():
        world["need"].q1 = 99
        world["need"].save()
        raise RuntimeError
    assert _version() == before


def test_commit_wakes_the_relay(world):
    db = connection.settings_dict
    with psycopg.connect(dbname=db["NAME"], user=db["USER"], password=db["PASSWORD"], host=db["HOST"],
                         port=db["PORT"], autocommit=True) as listener:
        listener.execute("LISTEN needs_changed")
        world["need"].q1 = 7
        world["need"].save()
        received = [n.payload for n in listener.notifies(timeout=5, stop_after=1)]
    assert received == [str(_version())]


def test_snapshot_carries_the_version_of_what_it_shows(world):
    world["submission"].status = Submission.Status.VALIDATED
    world["submission"].save()
    snap = build_snapshot()
    assert snap["version"] == _version()
    rows = snap["years"]["2027"]["needs_by_branch_brand"]["motors"]["rows"]
    assert rows == [{"country": "BENIN", "brand": "Toyota", "needs": 3, "technicians": 4}]
