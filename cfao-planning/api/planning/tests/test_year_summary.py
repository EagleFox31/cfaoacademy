"""Résumé annuel des cartes du centre : écrit à l'écriture, lu tel quel.

Preuves : les lignes de besoins rangées donnent la même chose que l'analyse du
JSON ; le résumé stocké égale le tableau global tous pôles ; le rattrapage est
idempotent ; l'endpoint ne calcule rien.
"""
import copy
import datetime as dt
import sys
from decimal import Decimal
from pathlib import Path

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "contracts"))

import kit  # noqa: E402

from core.auth.principal import Principal  # noqa: E402
from planning import views  # noqa: E402
from planning.clients import needs as client  # noqa: E402
from planning.models import (  # noqa: E402
    CostKeyYear, NeedsLine, PlannedAllocation, PlannedSession, YearSummary)
from planning.services import year_summary  # noqa: E402
from planning.services.cost_key_freeze import freeze  # noqa: E402
from planning.services.needs_copy import PUSH, apply_snapshot  # noqa: E402
from planning.services.needs_lines import resolved_needs, sync_needs_lines  # noqa: E402
from planning.services.year_summary import (  # noqa: E402
    FIELDS, compute_summary, ensure_year_summaries, synthese)
from referential.models import Brand, Country, CountryAlias  # noqa: E402

pytestmark = pytest.mark.django_db
SUMMARY = "/api/v1/planning/years/summary"

MOTORS_ROWS = [
    {"country": "Cameroun", "brand": "TOYOTA", "needs": 4, "technicians": 3},
    {"country": "CFR", "brand": "TOYOTA", "needs": 2, "technicians": None},  # alias, même cellule
    {"country": "RCI", "brand": "OMODA & JAEECO", "needs": 5, "technicians": 2},  # alias de marque
    {"country": "CAMEROON", "brand": "TOYOTA", "needs": 9, "technicians": 1},  # libellé inconnu
    {"country": "Côte d'Ivoire", "brand": "TOYOTA", "needs": 0, "technicians": None},
]


def _pole(rows, source="needs_api"):
    return {"source": source, "rows": rows,
            "postponed": [{"country": "Cameroun", "brand": "TOYOTA", "code": "ts-01", "places": 2}],
            "unassigned": [{"country": "RCI", "brand": "TOYOTA", "code": "TS02", "places": 1}]}


def _snapshot(version=1, years=(2026,), motors=MOTORS_ROWS):
    spec = kit.load_spec("needs-analytics")
    example = kit.response_example(spec, client.SNAPSHOT)
    doc = copy.deepcopy(example)
    doc["version"] = version
    year = copy.deepcopy(example["years"]["2026"])
    year["needs_by_branch_brand"] = {"motors": _pole(motors),
                                     "equipment": _pole(motors[:1], source="quota_import"),
                                     "all": _pole(motors)}
    doc["years"] = {str(y): copy.deepcopy(year) for y in years}
    return doc


@pytest.fixture(autouse=True)
def offline(settings):
    settings.NEEDS_API_URL, settings.NEEDS_ANALYTICS_KEY = "", ""
    settings.NEEDS_SNAPSHOT_BACKGROUND = False
    settings.ACADEMY_SITE, settings.ACADEMY_COUNTRY_CODE = "DOUALA", "cm"
    client.reset_refresh_clock()


@pytest.fixture
def fake_pdp(monkeypatch):
    def allowed(principal, kind, attr, action):
        roles = set(principal["roles"])
        if "learner" in roles:
            return False
        if "workshop_manager" in roles and kind == "planning_country_sheet":
            return any(s in attr.get("orgPath", []) for s in principal["attr"]["scopeNodes"])
        return kind in ("planning_cost_key", "planning_country_sheet") and action in ("view", "list")
    monkeypatch.setattr(views.cerbos, "check", lambda p, kind, rid, attr, action: allowed(p, kind, attr, action))
    monkeypatch.setattr(views.cerbos, "check_many", lambda p, kind, resources, action: {
        rid for rid, attr in resources if allowed(p, kind, attr, action)})


def client_for(role, scope="cfao"):
    c = APIClient()
    c.force_authenticate(user=Principal(id=f"u_{role}", roles=[role], display_name=role,
                                        attr={"scopeNodes": [scope], "locale": "fr"}))
    return c


@pytest.fixture
def world(referential, django_capture_on_commit_callbacks):
    """2026 : clé Motors (cm + ci) et clé Equipment (cm), besoins copiés ; les rappels
    de fin de transaction s'exécutent comme en production."""
    with django_capture_on_commit_callbacks(execute=True):
        apply_snapshot(_snapshot(), PUSH)
        ci = Country.objects.get(code="ci")
        motors = CostKeyYear.objects.create(year=2026, pole="MOTORS", budget=Decimal(1000), seats_offered=40)
        motors.enrolled_countries.set([referential["cm"], ci])
        p = PlannedSession.objects.create(
            cost_key=motors, brand=referential["toyota"], code_norm="TS01", country=referential["cm"],
            location="Douala", start_date=dt.date(2026, 3, 2), end_date=dt.date(2026, 3, 6))
        PlannedAllocation.objects.create(planned_session=p, country=referential["cm"], seats=6)
        PlannedAllocation.objects.create(planned_session=p, country=ci, seats=4)
        lovol = Brand.objects.create(code="lovol", label="LOVOL", pole="EQUIPMENT")
        eq = CostKeyYear.objects.create(year=2026, pole="EQUIPMENT", budget=Decimal(500), seats_offered=20)
        eq.enrolled_countries.set([referential["cm"]])
        s = PlannedSession.objects.create(
            cost_key=eq, brand=lovol, code_norm="LV01", country=referential["cm"],
            location="Douala", start_date=dt.date(2026, 5, 4), end_date=dt.date(2026, 5, 8))
        PlannedAllocation.objects.create(planned_session=s, country=referential["cm"], seats=5)
    return {"motors": motors, "equipment": eq, "session": p}


def _stored(year):
    row = YearSummary.objects.filter(year=year).first()
    return {f: getattr(row, f) for f in FIELDS} if row else None


def _from_global(year):
    """Ce que le front calculait à partir du tableau global, via l'API."""
    g = client_for("dps").get(f"/api/v1/planning/years/{year}/global").json()
    return synthese(g, list(CostKeyYear.objects.filter(year=year).order_by("pole")))


# ── Lignes de besoins = analyse du JSON ──────────────────────────────────────

@pytest.mark.parametrize("pole,header", [("MOTORS", "motors"), ("EQUIPMENT", "equipment")])
def test_lignes_rangees_egales_a_l_analyse_du_json(referential, pole, header):
    apply_snapshot(_snapshot(), PUSH)
    parsed = client._parse_needs(_snapshot()["years"]["2026"]["needs_by_branch_brand"][header])
    stored = resolved_needs(2026, pole)
    for field in ("available", "source", "by_country", "by_cell", "postponed", "unassigned", "warnings"):
        assert getattr(stored, field) == getattr(parsed, field), field
    if pole == "MOTORS":
        assert stored.by_cell[("cm", "toyota")] == (6, 3), "deux libellés du même pays : une cellule"
        assert stored.warnings == [{"code": "unknown_country", "value": "CAMEROON"}]


def test_annee_absente_et_aucune_copie(referential):
    assert resolved_needs(2026, "MOTORS").warnings == [{"code": "needs_unavailable"}]
    apply_snapshot(_snapshot(), PUSH)
    data = resolved_needs(2031, "MOTORS")
    assert (data.available, data.source, data.by_cell) == (True, "none", {})


def test_rangement_idempotent_et_copie_suivante(referential):
    apply_snapshot(_snapshot(1), PUSH)
    assert sync_needs_lines() == 0, "base à jour : zéro écriture"
    apply_snapshot(_snapshot(2, years=(2027,)), PUSH)
    assert set(NeedsLine.objects.values_list("year", flat=True)) == {2027}


def test_alias_ajoute_apres_la_copie(world, django_capture_on_commit_callbacks):
    before = _stored(2026)["needs"]
    with django_capture_on_commit_callbacks(execute=True):
        CountryAlias.objects.create(alias_norm="CAMEROON", country=Country.objects.get(code="cm"))
    assert resolved_needs(2026, "MOTORS").by_cell[("cm", "toyota")] == (15, 4)
    assert _stored(2026)["needs"] == before + 9


# ── Résumé = tableau global ──────────────────────────────────────────────────

def test_resume_egal_au_tableau_global(world, fake_pdp):
    stored = _stored(2026)
    assert stored == _from_global(2026) == compute_summary(2026)
    # Motors : cm 6 + ci 5 (alias) ; Equipment : cm 4. Places 6 + 4 + 5.
    assert (stored["needs"], stored["seats"], stored["seats_offered"]) == (15, 15, 60)
    assert stored["fill_rate"] == 25 and stored["status"] == "DRAFT"
    assert (stored["answered"], stored["known"]) == (2, 2), "ci répond à 0 sur Motors seulement"


def test_chaque_ecriture_recalcule_l_annee(world, fake_pdp, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        PlannedAllocation.objects.filter(planned_session=world["session"], country__code="ci").update(seats=9)
        year_summary.schedule(sessions={world["session"].pk})  # écriture en masse : signalée à la main
    assert _stored(2026)["seats"] == 20
    with django_capture_on_commit_callbacks(execute=True):
        world["motors"].enrolled_countries.remove(Country.objects.get(code="ci"))
    assert _stored(2026) == _from_global(2026)
    with django_capture_on_commit_callbacks(execute=True):
        freeze(world["motors"], "test")
        freeze(world["equipment"], "test")
    assert _stored(2026)["status"] == "FROZEN" == _from_global(2026)["status"]
    YearSummary.objects.create(year=2030, status="DRAFT", answered=0, known=0, needs=0, seats=0,
                               computed_at=dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc))
    assert ensure_year_summaries() == 1 and _stored(2030) is None, "année sans clé : pas de ligne"


def test_places_attribuees_lues_sur_les_fiches(world, fake_pdp, django_capture_on_commit_callbacks):
    """Clé en préparation : un pays sans session compte les places en couleur de ses
    fiches (besoins − sans couleur − rouge). Clé gelée : les sessions seules."""
    with django_capture_on_commit_callbacks(execute=True):
        PlannedAllocation.objects.filter(planned_session=world["session"], country__code="cm").delete()
        year_summary.schedule(sessions={world["session"].pk})
    # Motors : cm 6 − 2 rouges = 4 (aucune session), ci max(4 en session, 5 − 1 sans couleur) = 4 ;
    # Equipment : cm 5 en session.
    assert _stored(2026)["seats"] == 13 == _from_global(2026)["seats"]
    with django_capture_on_commit_callbacks(execute=True):
        freeze(world["motors"], "test")
    assert _stored(2026)["seats"] == 9, "clé gelée : cm 0 + ci 4 + Equipment 5"


def test_synthese_compte_une_filiale_une_fois():
    g = {"status": "DRAFT", "total_seats": 7, "brand_totals": {"a": {"needs": 3}, "b": {"needs": None}},
         "responses": [{"answered": ["cm", "ci"], "known": ["cm", "ci", "sn"]},
                       {"answered": ["cm"], "known": ["cm", "ga"]}]}
    keys = [type("K", (), {"seats_offered": 8})(), type("K", (), {"seats_offered": None})()]
    assert synthese(g, keys) == {"status": "DRAFT", "answered": 2, "known": 4, "needs": 3, "seats": 7,
                                 "seats_offered": 8, "fill_rate": 88}
    assert synthese({**g, "total_seats": None}, keys[1:])["fill_rate"] is None


# ── Rattrapage au démarrage ──────────────────────────────────────────────────

def test_rattrapage_idempotent(world):
    YearSummary.objects.all().delete()
    NeedsLine.objects.all().delete()
    call_command("sync_needs_snapshot")
    assert _stored(2026) == compute_summary(2026)
    assert sync_needs_lines() == 0 and ensure_year_summaries() == 0, "second démarrage : zéro écriture"
    call_command("check_year_summary", "--year", "2026")


def test_controle_signale_un_ecart(world):
    YearSummary.objects.filter(year=2026).update(seats=1)
    with pytest.raises(Exception):
        call_command("check_year_summary")


# ── Endpoint : lecture pure ──────────────────────────────────────────────────

def test_endpoint_lit_sans_calculer(world, fake_pdp, monkeypatch, django_assert_max_num_queries):
    monkeypatch.setattr("planning.services.cost_key_global.global_table",
                        lambda *a, **k: pytest.fail("aucun calcul à la lecture"))
    with django_assert_max_num_queries(4):
        r = client_for("dps").get(SUMMARY)
    assert r.status_code == 200
    [row] = r.json()["years"]
    assert {k: row[k] for k in FIELDS} == _stored(2026) and row["year"] == 2026


def test_endpoint_refuse_les_lecteurs_restreints(world, fake_pdp):
    assert client_for("learner").get(SUMMARY).status_code == 403
    assert client_for("workshop_manager", scope="ci").get(SUMMARY).status_code == 403


def test_points_a_traiter_de_l_annee(world, fake_pdp):
    items = client_for("dps").get("/api/v1/planning/years/2026/review-items")
    assert items.status_code == 200
    g = client_for("dps").get("/api/v1/planning/years/2026/global").json()
    assert items.json() == g["review_items"]
