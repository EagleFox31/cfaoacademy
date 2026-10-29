"""Agrégats analytics sur les données d'arbitrage importées."""

import importlib
from datetime import date

import pytest
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
