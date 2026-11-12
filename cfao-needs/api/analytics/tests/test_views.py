"""Agrégats analytics sur les données d'arbitrage importées."""

import importlib
from datetime import date

import pytest

from analytics.tests.test_contract import _validator
from django.apps import apps
from django.db import connection
from rest_framework.test import APIClient

from campaigns.models import BranchBrandQuota, Campaign, CourseAllocation, TrainingSession

KEY = "views-test-key"


@pytest.fixture
def client(settings):
    settings.ANALYTICS_INBOUND_KEY = KEY
    return APIClient(HTTP_X_ANALYTICS_KEY=KEY)


@pytest.fixture
def campaign(db):
    other = Campaign.objects.create(year=2025, label="2025")
    CourseAllocation.objects.create(campaign=other, brand="TOYOTA", code="X", title="X", country="TOGO",
                                    allocated_seats=99)
    BranchBrandQuota.objects.create(campaign=other, pole="MOTORS", country="TOGO", brand="TOYOTA",
                                    total_branch_techs=99)
    return Campaign.objects.create(year=2026, label="2026")


def _allocation(campaign, country, seats, code="M1"):
    CourseAllocation.objects.create(campaign=campaign, brand="TOYOTA", code=code, title=code, country=country,
                                    allocated_seats=seats)


def test_allocations_sum_by_country_without_summary_rows(client, campaign):
    _allocation(campaign, "TOGO", 10)
    _allocation(campaign, "TOGO", 5, code="M2")
    _allocation(campaign, "GABON", 20)
    for country in ("Total demandées", "PLACÉES AU CAMEROUN", "Reste à placer"):
        _allocation(campaign, country, 500)

    response = client.get("/api/v1/needs/analytics/allocations-per-branch", {"year": 2026})

    assert response.json() == {"year": 2026, "allocations": [
        {"country": "GABON", "seats": 20},
        {"country": "TOGO", "seats": 15},
    ]}


@pytest.mark.parametrize("bu, expected", [("all", 50), ("motors", 30), ("equipment", 20), ("inconnu", 50)])
def test_technicians_count_each_branch_once(client, campaign, bu, expected):
    for brand in ("TOYOTA", "SUZUKI"):  # effectif pays répété sur chaque marque
        BranchBrandQuota.objects.create(campaign=campaign, pole="MOTORS", country="TOGO", brand=brand,
                                        total_branch_techs=30)
    BranchBrandQuota.objects.create(campaign=campaign, pole="EQUIPMENT", country="TOGO", brand="CAT",
                                    total_branch_techs=20)

    response = client.get("/api/v1/needs/analytics/total-technicians", {"year": 2026, "bu": bu})

    assert response.json() == {"bu": bu if bu != "inconnu" else "all", "year": 2026, "count": expected}


@pytest.mark.django_db
def test_scheduled_trainings_count_the_year(client):
    for index, year in enumerate((2026, 2026, 2025)):
        TrainingSession.objects.create(session_index=index, year=year, pole="MOTORS", brand="TOYOTA", title="T",
                                       location="Douala", version_source="v5", start_date=date(year, 3, 1))

    assert client.get("/api/v1/needs/analytics/scheduled-trainings", {"year": 2026}).json() == {
        "year": 2026, "count": 2}


@pytest.mark.django_db(transaction=True)
def test_migration_adopts_tables_already_created_by_ingestion():
    migration = importlib.import_module("campaigns.migrations.0004_donnees_arbitrage")
    with connection.schema_editor() as editor:
        migration.adopt_or_create(apps, editor)  # tables présentes : aucune création, aucune erreur
    assert {"campaigns_branchbrandquota", "campaigns_courseallocation", "campaigns_trainingsession"} <= set(
        connection.introspection.table_names())


# ── Clé de répartition (cfao-planning) ─────────────────────────────────────────

from campaigns.models import CatalogLine, NeedLine, Submission  # noqa: E402
from referential.models import Brand, CatalogFamily, OrgUnitRef  # noqa: E402


def _catalog(campaign, code, brand=None, pole="MOBILITY"):
    family, _ = CatalogFamily.objects.get_or_create(key=f"f-{pole}", defaults={"label": pole, "pole": pole})
    return CatalogLine.objects.create(campaign=campaign, family=family, brand=brand, code=code, title=code)


def _submission(campaign, country, status=Submission.Status.VALIDATED):
    unit, _ = OrgUnitRef.objects.get_or_create(code=f"ou-{country.lower()}", defaults={"label": country})
    return Submission.objects.create(campaign=campaign, org_unit=unit, country=country, status=status)


def test_needs_fall_back_to_quota_import(client, campaign):
    BranchBrandQuota.objects.create(campaign=campaign, pole="MOTORS", country="BENIN", brand="TOYOTA",
                                    brand_tech_count=22, requested_needs=34)
    BranchBrandQuota.objects.create(campaign=campaign, pole="EQUIPMENT", country="BENIN", brand="CAT",
                                    brand_tech_count=5, requested_needs=9)
    body = client.get("/api/v1/needs/analytics/needs-by-branch-brand", {"year": 2026, "pole": "motors"}).json()
    assert body["source"] == "quota_import"
    assert body["rows"] == [{"country": "BENIN", "brand": "TOYOTA", "needs": 34, "technicians": 22}]


def test_validated_submissions_replace_imported_needs(client, campaign):
    BranchBrandQuota.objects.create(campaign=campaign, pole="MOTORS", country="BENIN", brand="Toyota",
                                    brand_tech_count=22, requested_needs=34)
    toyota = Brand.objects.create(code="toyota", label="Toyota", pole="MOBILITY")
    line = _catalog(campaign, "TS01", toyota)
    NeedLine.objects.create(submission=_submission(campaign, "BENIN"), catalog_line=line, q1=3, q3=2)
    # Une fiche non validée ne compte pas.
    NeedLine.objects.create(submission=_submission(campaign, "TOGO", Submission.Status.SUBMITTED),
                            catalog_line=line, q1=50)
    body = client.get("/api/v1/needs/analytics/needs-by-branch-brand", {"year": 2026}).json()
    assert body["source"] == "submissions"
    assert body["rows"] == [{"country": "BENIN", "brand": "Toyota", "needs": 5, "technicians": 22}]


def test_needs_empty_year_says_none(client, campaign):
    body = client.get("/api/v1/needs/analytics/needs-by-branch-brand", {"year": 2030}).json()
    assert body == {"year": 2030, "pole": "all", "source": "none", "rows": [], "postponed": []}


def test_unchosen_modules_lists_catalog_without_validated_demand(client, campaign):
    toyota = Brand.objects.create(code="toyota", label="Toyota", pole="MOBILITY")
    chosen, idle, zero = (_catalog(campaign, c, toyota) for c in ("TS01", "TS02", "TS03"))
    _catalog(campaign, "EQ01", pole="EQUIPMENT")
    sub = _submission(campaign, "BENIN")
    NeedLine.objects.create(submission=sub, catalog_line=chosen, q2=1)
    NeedLine.objects.create(submission=sub, catalog_line=zero)  # ligne à 0 : non choisie
    body = client.get("/api/v1/needs/analytics/unchosen-modules", {"year": 2026, "pole": "motors"}).json()
    assert body["catalog_available"] is True
    assert [m["code"] for m in body["modules"]] == ["TS02", "TS03"]
    assert body["modules"][0] == {"pole": "MOBILITY", "brand": "Toyota", "tier": None, "code": "TS02",
                                  "title": "TS02"}


def test_unchosen_modules_without_catalog(client, campaign):
    body = client.get("/api/v1/needs/analytics/unchosen-modules", {"year": 2026}).json()
    assert body["catalog_available"] is False and body["modules"] == []


# ── Niveau des modules, source unique : le catalogue ───────────────────────────

CATALOG_LEVEL = "/api/v1/needs/analytics/catalog-level"
WRITE_KEY = {"HTTP_X_CATALOG_WRITE_KEY": "write-key"}


@pytest.fixture
def scale(campaign, settings):
    settings.CATALOG_WRITE_INBOUND_KEY = "write-key"
    toyota = Brand.objects.create(code="toyota", label="TOYOTA", pole="MOBILITY")
    lines = {}
    for code, label, tier in (("TS01", "G4", "JUNIOR"), ("TS03", "G3", "SENIOR"), ("TS04", "", "")):
        lines[code] = _catalog(campaign, code, toyota)
        CatalogLine.objects.filter(pk=lines[code].pk).update(level_label=label, tier=tier)
        lines[code].refresh_from_db()
    return lines


def _set_level(client, ids, expected, label, **extra):
    return client.post(CATALOG_LEVEL, {"line_ids": ids, "expected": expected, "level_label": label},
                       format="json", **extra)


def test_catalog_levels_gives_the_brand_scale(client, scale):
    body = client.get("/api/v1/needs/analytics/catalog-levels", {"year": 2026}).json()
    assert body["catalog_available"] is True
    assert {(l["code"], l["level_label"], l["tier"]) for l in body["lines"]} == {
        ("TS01", "G4", "JUNIOR"), ("TS03", "G3", "SENIOR"), ("TS04", "", None)}
    assert all(l["family"] == scale[l["code"]].family.key for l in body["lines"])


def test_level_is_written_with_the_tier_of_the_scale(client, scale):
    res = _set_level(client, [str(scale["TS04"].pk)], "", "G3", **WRITE_KEY)
    assert res.status_code == 200 and res.json() == {"changed": True, "level_label": "G3", "tier": "SENIOR"}
    scale["TS04"].refresh_from_db()
    assert (scale["TS04"].level_label, scale["TS04"].tier) == ("G3", "SENIOR")


def test_level_outside_the_brand_scale_is_refused(client, scale):
    res = _set_level(client, [str(scale["TS01"].pk)], "G4", "Bronze", **WRITE_KEY)
    assert res.status_code == 400 and res.json()["detail"] == "label_not_in_scale"


def test_stale_level_is_a_conflict_and_writes_nothing(client, scale):
    res = _set_level(client, [str(scale["TS01"].pk)], "G3", "G3-bis", **WRITE_KEY)
    assert res.status_code == 409 and res.json()["current"] == "G4"
    scale["TS01"].refresh_from_db()
    assert scale["TS01"].level_label == "G4"


def test_level_can_be_cleared(client, scale):
    res = _set_level(client, [str(scale["TS03"].pk)], "G3", "", **WRITE_KEY)
    assert res.status_code == 200 and res.json()["tier"] is None


def test_level_write_matches_the_published_contract(client, scale):
    res = _set_level(client, [str(scale["TS04"].pk)], "", "G4", **WRITE_KEY)
    assert res.status_code == 200
    assert list(_validator(CATALOG_LEVEL, 200, "post").iter_errors(res.json())) == []


def test_level_write_refuses_the_read_key(client, scale):
    res = _set_level(client, [str(scale["TS01"].pk)], "G4", "G3", HTTP_X_ANALYTICS_KEY="anything")
    assert res.status_code in (401, 403)


def test_postponed_seats_stay_in_the_needs(client, campaign):
    toyota = Brand.objects.create(code="toyota", label="Toyota", pole="MOBILITY")
    line = _catalog(campaign, "TS11", toyota)
    NeedLine.objects.create(submission=_submission(campaign, "BENIN"), catalog_line=line, q1=2, q4=3, postponed=3)
    body = client.get("/api/v1/needs/analytics/needs-by-branch-brand", {"year": 2026}).json()
    assert body["rows"][0]["needs"] == 5
    assert body["postponed"] == [{"country": "BENIN", "brand": "Toyota", "code": "TS11", "places": 3}]
