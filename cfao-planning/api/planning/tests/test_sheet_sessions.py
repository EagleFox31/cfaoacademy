"""Sessions « fiche » : les places en couleur des fiches que le classeur ne couvre pas."""
import datetime as dt
from decimal import Decimal

import pytest

from planning.models import CostKeyYear, NeedsModuleLine, PlannedAllocation, PlannedSession
from planning.services.sheet_sessions import sync_key

pytestmark = pytest.mark.django_db
Kind = NeedsModuleLine.Kind


@pytest.fixture(autouse=True)
def academy(settings):
    settings.ACADEMY_SITE, settings.ACADEMY_COUNTRY_CODE = "DOUALA", "cm"


@pytest.fixture
def key(referential):
    from referential.models import Country

    referential["ci"] = Country.objects.get(code="ci")
    k = CostKeyYear.objects.create(year=2027, pole="MOTORS", budget=Decimal(1000), seats_offered=40)
    k.enrolled_countries.set([referential["cm"], referential["ci"]])
    return k


def _sheet(referential, kind, country, places, code="TS01"):
    NeedsModuleLine.objects.create(year=2027, pole="motors", kind=kind, country=referential[country],
                                   brand=referential["toyota"], code_norm=code, places=places)


def _rows(key):
    return sorted((s.code_norm, s.location, s.country.code, a.country.code, a.seats)
                  for s in key.planned_sessions.filter(origin=PlannedSession.Origin.NEEDS_SHEET)
                  for a in s.allocations.all())


def test_classeur_couvre_douala_d_abord(key, referential):
    _sheet(referential, Kind.AT_ACADEMY, "ci", 3)
    _sheet(referential, Kind.IN_SUBSIDIARY, "ci", 4)
    _sheet(referential, Kind.POSTPONED, "ci", 5)  # rouge : jamais une place
    _sheet(referential, Kind.UNASSIGNED, "ci", 6)  # sans couleur : jamais une place
    s = PlannedSession.objects.create(cost_key=key, brand=referential["toyota"], code_norm="TS01",
                                      country=referential["cm"], location="Douala",
                                      start_date=dt.date(2027, 3, 1), end_date=dt.date(2027, 3, 5))
    PlannedAllocation.objects.create(planned_session=s, country=referential["ci"], seats=5)
    assert sync_key(key) == 1
    assert _rows(key) == [("TS01", referential["ci"].label, "ci", "ci", 2)], "5 en session : 3 Douala + 2 filiale"
    assert sync_key(key) == 0, "idempotent"


def test_filiale_au_cameroun_reste_en_filiale(key, referential):
    _sheet(referential, Kind.IN_SUBSIDIARY, "cm", 3)
    assert sync_key(key) == 1 and sync_key(key) == 0
    assert _rows(key) == [("TS01", referential["cm"].label, "cm", "cm", 3)]


def test_cle_gelee_intouchee(key, referential):
    _sheet(referential, Kind.AT_ACADEMY, "ci", 3)
    CostKeyYear.objects.filter(pk=key.pk).update(status="FROZEN")
    key.refresh_from_db()
    assert sync_key(key) == 0 and _rows(key) == []


def test_intitule_du_catalogue_et_lieu_academy(key, referential):
    from planning.models import NeedsCopyYear

    NeedsCopyYear.objects.create(year=2027, version=1, payload={"catalog_levels": {"lines": [
        {"id": "1", "brand": "TOYOTA", "code": "TS01", "family": "f", "title": "Moteur essence",
         "level_label": "", "tier": None, "sort_order": 1}]}})
    _sheet(referential, Kind.AT_ACADEMY, "ci", 3)
    assert sync_key(key) == 1 and sync_key(key) == 0
    s = key.planned_sessions.get(origin=PlannedSession.Origin.NEEDS_SHEET)
    assert (s.title, s.location, s.country.code) == ("Moteur essence", "Academy de Douala", "cm")


def test_sessions_existantes_mises_a_jour(key, referential):
    _sheet(referential, Kind.IN_SUBSIDIARY, "ci", 3)
    assert sync_key(key) == 1
    key.planned_sessions.update(location="Filiale")  # ancienne version
    assert sync_key(key) == 1 and sync_key(key) == 0
    assert _rows(key) == [("TS01", referential["ci"].label, "ci", "ci", 3)]
