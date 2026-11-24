import datetime as dt
from decimal import Decimal

import pytest

from planning.models import (
    CostKeyYear, PlannedAllocation, PlannedSession, SeatAllocation, Session, SessionStatus,
)
from planning.services.cost_key import compare
from planning.services.cost_key_freeze import freeze
from planning.services.plan_match import MatchStatus, match
from referential.models import Brand, Country

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def academy(settings):
    settings.ACADEMY_SITE = "DOUALA"
    settings.ACADEMY_COUNTRY_CODE = "cm"


@pytest.fixture
def world(referential):
    ci = Country.objects.get(code="ci")
    sn = Country.objects.create(code="sn", label="Sénégal", org_path=["cfao", "sn"])
    key = CostKeyYear.objects.create(year=2026, pole="MOTORS", budget=Decimal(1000))
    key.enrolled_countries.set([referential["cm"], ci])
    return {**referential, "ci": ci, "sn": sn, "key": key}


def planned(world, code="TS03", host=None, day=2, **seats):
    p = PlannedSession.objects.create(
        cost_key=world["key"], brand=world["toyota"], code_norm=code,
        country=host or world["cm"], location="Douala" if host is None else "",
        start_date=dt.date(2026, 3, day),
    )
    for c, n in seats.items():
        PlannedAllocation.objects.create(planned_session=p, country=Country.objects.get(code=c),
                                         seats=n)
    return p


def actual(world, code="TS03", host=None, day=2, year=2026, brand=None,
           status=SessionStatus.PLANNED, **seats):
    start = dt.date(year, 3, day)
    s = Session.objects.create(
        year=year, brand=brand or world["toyota"], training_type="TECHNIQUE", code_norm=code,
        title=code, country=host or world["cm"], location="Douala" if host is None else "",
        start_date=start, end_date=start + dt.timedelta(days=4), days=5, status=status,
    )
    for c, n in seats.items():
        SeatAllocation.objects.create(session=s, country=Country.objects.get(code=c), seats=n)
    return s


def statuses(world):
    return [(g.code_norm, g.status) for g in match(world["key"])]


def test_un_pour_un_avec_date_decalee_matched(world):
    planned(world, day=2)
    actual(world, day=16)
    assert statuses(world) == [("TS03", MatchStatus.MATCHED)]


def test_extra_et_shortfall(world):
    planned(world, "TS03")
    actual(world, "TS03", day=2)
    actual(world, "TS03", day=9)
    planned(world, "TS04", day=2)
    planned(world, "TS04", day=9)
    actual(world, "TS04")
    assert statuses(world) == [("TS03", MatchStatus.EXTRA), ("TS04", MatchStatus.SHORTFALL)]


def test_annulee_planned_only_et_ajoutee_actual_only(world):
    planned(world, "TS03")
    actual(world, "TS03", status=SessionStatus.CANCELLED)
    actual(world, "TS05")
    assert statuses(world) == [("TS03", MatchStatus.PLANNED_ONLY),
                               ("TS05", MatchStatus.ACTUAL_ONLY)]


def test_pas_de_lien_sur_autre_hote_annee_pole_ou_code_proche(world):
    planned(world, "TS03")
    actual(world, "TS03", host=world["ci"])
    actual(world, "TS03", year=2027)
    trucks = Brand.objects.create(code="hino", label="HINO", pole="EQUIPMENT")
    actual(world, "TS03", brand=trucks)
    actual(world, "TS03-G3")
    groups = match(world["key"])
    assert sorted((g.code_norm, g.host_id == world["ci"].pk, g.status) for g in groups) == [
        ("TS03", False, MatchStatus.PLANNED_ONLY),
        ("TS03", True, MatchStatus.ACTUAL_ONLY),
        ("TS03-G3", False, MatchStatus.ACTUAL_ONLY),
    ]


def test_comparaison_ecart_par_pays_et_budget_reparti_des_deux_cotes(world):
    planned(world, "TS03", cm=6, ci=3, sn=1)
    actual(world, "TS03", cm=4, ci=4, sn=2)
    report = compare(world["key"])
    lines = {l.code: l for l in report.lines}

    assert (lines["ci"].planned_seats, lines["ci"].actual_seats, lines["ci"].delta_seats) == (
        3, 4, 1)
    assert lines["ci"].delta_key_cost == Decimal(500) - Decimal(333)
    for side in (report.planned, report.actual):
        assert sum(l.key_cost for l in side.lines) == Decimal(1000)
    # Pays non enrôlé : visible avec ses places, jamais de part.
    assert (lines["sn"].enrolled, lines["sn"].planned_seats, lines["sn"].actual_key_cost) == (
        False, 1, 0)
    assert report.match == {MatchStatus.MATCHED: 1}


def test_comparaison_sur_cle_gelee_lit_le_snapshot(world):
    planned(world, "TS03", cm=6, ci=3)
    freeze(world["key"], "dg")
    world["key"].refresh_from_db()
    actual(world, "TS03", cm=5)
    lines = {l.code: l for l in compare(world["key"]).lines}
    assert (lines["cm"].planned_key_cost, lines["cm"].actual_key_cost) == (
        Decimal(667), Decimal(1000))
