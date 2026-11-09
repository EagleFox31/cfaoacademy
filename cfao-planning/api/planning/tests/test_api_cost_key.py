"""API de la clé : chaque vue décide via Cerbos (simulé ici par une table de
rôles), et les lecteurs de filiale ne voient que leurs pays."""
import datetime as dt
import io
from decimal import Decimal

import pytest
from openpyxl import Workbook, load_workbook
from rest_framework.test import APIClient

from core.auth.principal import Principal
from core.imports.models import ImportLog
from planning import views
from planning.clients.needs import NeedsData
from planning.models import CostKeyYear, PlannedAllocation, PlannedSession
from referential.models import Country

pytestmark = pytest.mark.django_db

"""Reflet de cerbos/policies/resource_policies/planning (testées à part par cerbos compile)."""
MANAGER = {"planning_cost_key": {"view", "list", "create", "update"},
           "planning_import": {"template", "preview", "apply", "list", "view"},
           "planning_catalog_gap": {"view"}, "planning_country_sheet": {"view"}}
PILOT = {**MANAGER, "planning_cost_key": MANAGER["planning_cost_key"] | {"freeze"}}
OBSERVER = {"planning_cost_key": {"view", "list"}, "planning_catalog_gap": {"view"},
            "planning_country_sheet": {"view"}}
READER = {"planning_cost_key": {"view", "list"}, "planning_country_sheet": {"view"}}
POLICY = {"center_assistant": MANAGER, "training_coordinator": PILOT, "dps": OBSERVER,
          "workshop_manager": READER}


def _allowed(principal, kind, attr, action):
    for role in principal["roles"]:
        if action in POLICY.get(role, {}).get(kind, set()):
            if role == "workshop_manager" and kind == "planning_country_sheet":
                return any(s in attr.get("orgPath", []) for s in principal["attr"]["scopeNodes"])
            return True
    return False


@pytest.fixture(autouse=True)
def fake_pdp(monkeypatch, settings):
    settings.ACADEMY_SITE, settings.ACADEMY_COUNTRY_CODE = "DOUALA", "cm"
    monkeypatch.setattr(views.cerbos, "check",
                        lambda p, kind, rid, attr, action: _allowed(p, kind, attr, action))
    monkeypatch.setattr(views.cerbos, "check_many", lambda p, kind, resources, action: {
        rid for rid, attr in resources if _allowed(p, kind, attr, action)})
    monkeypatch.setattr(views, "fetch_needs", lambda year, pole: NeedsData(
        available=True, source="quota_import", by_country={"cm": 10},
        by_cell={("cm", "toyota"): (10, 7)}))
    monkeypatch.setattr(views, "fetch_unchosen", lambda year, pole: {
        "available": True, "catalog_available": True, "warnings": [],
        "modules": [{"pole": "MOBILITY", "brand": "Toyota", "tier": "EXPERT", "code": "TS14",
                     "title": "Diagnostic"}]})


def client_for(role, scope="cfao"):
    c = APIClient()
    c.force_authenticate(user=Principal(id=f"u_{role}", roles=[role],
                                        attr={"scopeNodes": [scope], "locale": "fr"}))
    return c


@pytest.fixture
def key(referential):
    ci = Country.objects.get(code="ci")
    key = CostKeyYear.objects.create(year=2026, pole="MOTORS", budget=Decimal(1000))
    key.enrolled_countries.set([referential["cm"], ci])
    p = PlannedSession.objects.create(
        cost_key=key, brand=referential["toyota"], code_norm="TS01", country=referential["cm"],
        location="Douala", start_date=dt.date(2026, 3, 2), end_date=dt.date(2026, 3, 6))
    PlannedAllocation.objects.create(planned_session=p, country=referential["cm"], seats=6)
    PlannedAllocation.objects.create(planned_session=p, country=ci, seats=4)
    return key


def url(key, suffix=""):
    return f"/api/v1/planning/cost-keys/{key.pk}{suffix}"


def test_access_menu_par_role(db):
    assert client_for("training_coordinator").get("/api/v1/planning/access").json() == {
        "view": True, "manage": True, "freeze": True, "import": True, "gaps": True}
    assert client_for("center_assistant").get("/api/v1/planning/access").json()["freeze"] is False
    assert client_for("workshop_manager").get("/api/v1/planning/access").json() == {
        "view": True, "manage": False, "freeze": False, "import": False, "gaps": False}
    assert client_for("learner").get("/api/v1/planning/access").json()["view"] is False


def test_inconnu_refuse_partout(key):
    c = client_for("learner")
    for path in ("", "/report", "/global", "/compare", "/match", "/export.xlsx"):
        assert c.get(url(key, path)).status_code == 403, path
    assert c.get("/api/v1/planning/cost-keys/").status_code == 403


def test_amorcer_puis_regler(key):
    c = client_for("center_assistant")
    r = c.post("/api/v1/planning/cost-keys/", {"year": 2027, "pole": "MOTORS"}, format="json")
    assert r.status_code == 201 and r.json()["budget"] == 1000
    assert sorted(r.json()["enrolled"]) == ["ci", "cm"]
    r = c.patch(f"/api/v1/planning/cost-keys/{r.json()['id']}", {"budget": 1500}, format="json")
    assert r.status_code == 200 and r.json()["budget"] == 1500
    r = c.post("/api/v1/planning/cost-keys/", {"year": 2027, "pole": "MOTORS"}, format="json")
    assert r.status_code == 200  # déjà là : renvoyée, pas écrasée
    assert client_for("dps").post("/api/v1/planning/cost-keys/", {"year": 2028, "pole": "MOTORS"},
                                  format="json").status_code == 403


def test_geler_puis_reglage_refuse(key):
    c = client_for("training_coordinator")
    assert client_for("dps").post(url(key, "/freeze")).status_code == 403
    assert client_for("center_assistant").post(url(key, "/freeze")).status_code == 403
    r = c.post(url(key, "/freeze"))
    assert r.status_code == 200 and r.json()["status"] == "FROZEN"
    r = c.patch(url(key), {"budget": 1}, format="json")
    assert r.status_code == 409 and r.json()["error"]["code"] == "KEY_FROZEN"


def test_geler_une_cle_vide_refuse(referential):
    empty = CostKeyYear.objects.create(year=2031, pole="MOTORS", budget=Decimal(10))
    r = client_for("training_coordinator").post(url(empty, "/freeze"))
    assert r.status_code == 409 and r.json()["error"]["code"] == "FREEZE_REFUSED"


def test_rapport_et_comparaison(key):
    c = client_for("dps")
    report = c.get(url(key, "/report")).json()
    lines = {l["country"]: l for l in report["lines"]}
    assert lines["cm"]["key_cost"] + lines["ci"]["key_cost"] == 1000
    assert lines["cm"]["coverage"] == 0.6
    compare = c.get(url(key, "/compare")).json()
    cm = next(l for l in compare["lines"] if l["country"] == "cm")
    assert (cm["planned_seats"], cm["actual_seats"], cm["delta_seats"]) == (6, 0, -6)
    groups = c.get(url(key, "/match")).json()["groups"]
    assert groups and groups[0]["code"] == "TS01" and groups[0]["host"] == "cm"
    assert c.get(url(key, "/report?mode=xx")).status_code == 400


def test_lecteur_de_filiale_ne_voit_que_son_pays(key):
    c = client_for("workshop_manager", scope="ci")
    table = c.get(url(key, "/global")).json()
    assert [r["country"] for r in table["rows"]] == ["ci"] and table["partial"]
    assert c.get(url(key, "/countries/ci")).status_code == 200
    assert c.get(url(key, "/countries/cm")).status_code == 403
    assert c.get(url(key, "/countries/cm.xlsx")).status_code == 403
    assert c.get(url(key, "/unchosen-modules")).status_code == 403


def test_tableau_global_et_exports(key):
    c = client_for("dps")
    table = c.get(url(key, "/global")).json()
    cm = next(r for r in table["rows"] if r["country"] == "cm")
    assert cm["cells"]["toyota"] == {"needs": 10, "technicians": 7, "seats": 6, "coverage": 0.6}
    r = c.get(url(key, "/export.xlsx"))
    assert r.status_code == 200 and r["Content-Type"].startswith("application/vnd.openxml")
    wb = load_workbook(io.BytesIO(r.content))
    assert wb.sheetnames[0] == "GLOBAL"
    assert sorted(wb.sheetnames[1:]) == ["Cameroun", "Côte d'Ivoire"]
    r = c.get(url(key, "/countries/ci.xlsx?lang=en"))
    assert load_workbook(io.BytesIO(r.content)).active.cell(row=2, column=1).value == "Brand"
    assert c.get(url(key, "/countries/zz")).status_code == 404
    assert c.get(url(key, "/global.xlsx")).status_code == 200


@pytest.fixture
def equipment(key, referential):
    """Clé Equipment de la même année : 5 places pour le Cameroun seul."""
    from referential.models import Brand
    lovol = Brand.objects.create(code="lovol", label="LOVOL", pole="EQUIPMENT")
    eq = CostKeyYear.objects.create(year=2026, pole="EQUIPMENT", budget=Decimal(500))
    eq.enrolled_countries.set([referential["cm"]])
    p = PlannedSession.objects.create(
        cost_key=eq, brand=lovol, code_norm="LV01", country=referential["cm"],
        location="Douala", start_date=dt.date(2026, 5, 4), end_date=dt.date(2026, 5, 8))
    PlannedAllocation.objects.create(planned_session=p, country=referential["cm"], seats=5)
    return eq


def test_tous_poles_additionne_les_cles_de_l_annee(key, equipment):
    c = client_for("dps")
    motors = {r["country"]: r for r in c.get(url(key, "/global")).json()["rows"]}
    table = c.get("/api/v1/planning/years/2026/global").json()
    assert (table["pole"], table["poles"], table["budget"]) == ("ALL", ["EQUIPMENT", "MOTORS"], 1500)
    assert table["hourly_cost"] is None and table["total_seats"] == 15
    rows = {r["country"]: r for r in table["rows"]}
    assert rows["cm"]["seats"] == 11 and rows["cm"]["key_cost"] == motors["cm"]["key_cost"] + 500
    assert rows["ci"]["total"] == motors["ci"]["total"]
    grand = sum(r["total"] for r in rows.values())
    assert rows["cm"]["share"] == round(rows["cm"]["total"] / grand, 6)
    assert rows["cm"]["cells"]["lovol"]["seats"] == 5 and rows["ci"]["cells"]["lovol"]["seats"] == 0
    assert table["brand_totals"]["lovol"]["seats"] == 5
    sheet = c.get("/api/v1/planning/years/2026/countries/cm").json()
    assert sorted(s["code"] for s in sheet["sessions"]) == ["LV01", "TS01"]
    assert sheet["footer"]["total"] == rows["cm"]["total"] and sheet["pole"] == "ALL"
    for suffix in ("/global.xlsx", "/countries/cm.xlsx", "/export.xlsx"):
        assert c.get(f"/api/v1/planning/years/2026{suffix}").status_code == 200, suffix


def test_tous_poles_une_seule_cle_egale_la_cle(key):
    c = client_for("dps")
    single = c.get(url(key, "/global")).json()
    table = c.get("/api/v1/planning/years/2026/global").json()
    pick = lambda rows: {r["country"]: (r["seats"], r["total"], r["share"]) for r in rows}
    assert pick(table["rows"]) == pick(single["rows"]) and table["budget"] == single["budget"]


def test_tous_poles_perimetre_et_droits(key, equipment):
    c = client_for("workshop_manager", scope="ci")
    full = client_for("dps").get("/api/v1/planning/years/2026/global").json()
    table = c.get("/api/v1/planning/years/2026/global").json()
    assert [r["country"] for r in table["rows"]] == ["ci"] and table["partial"]
    # la part reste celle de l'ensemble, pas celle des seuls pays visibles
    assert table["rows"][0]["share"] == next(r for r in full["rows"] if r["country"] == "ci")["share"]
    assert c.get("/api/v1/planning/years/2026/countries/cm").status_code == 403
    assert c.get("/api/v1/planning/years/2026/countries/ci").status_code == 200
    assert client_for("learner").get("/api/v1/planning/years/2026/global").status_code == 403
    assert client_for("dps").get("/api/v1/planning/years/2030/global").status_code == 404
    assert client_for("dps").get("/api/v1/planning/years/2026/countries/zz").status_code == 404


def test_saisie_du_taux_horaire(key):
    c = client_for("center_assistant")
    r = c.patch(url(key), {"hourly_rate": 2500}, format="json")
    assert r.status_code == 200 and r.json()["hourly_rate"] == 2500
    assert c.patch(url(key), {"hourly_rate": -1}, format="json").status_code == 400
    assert c.patch(url(key), {"hourly_rate": None}, format="json").json()["hourly_rate"] is None
    assert client_for("dps").patch(url(key), {"hourly_rate": 1}, format="json").status_code == 403


def test_abc_droits_et_perimetre(key, equipment):
    table = client_for("dps").get(url(key, "/abc")).json()
    cm = next(r for r in table["rows"] if r["country"] == "cm")
    assert (cm["a"], cm["b"], cm["c"]) == (6, 10, 7)
    assert sum(r["amount_a"] for r in table["rows"]) == 1000
    scoped = client_for("workshop_manager", scope="ci").get(url(key, "/abc")).json()
    assert [r["country"] for r in scoped["rows"]] == ["ci"] and scoped["partial"]
    year = client_for("dps").get("/api/v1/planning/years/2026/abc").json()
    assert year["pole"] == "ALL" and year["budget"] == 1500
    assert next(r for r in year["rows"] if r["country"] == "cm")["a"] == 11
    assert client_for("learner").get(url(key, "/abc")).status_code == 403
    assert client_for("learner").get("/api/v1/planning/years/2026/abc").status_code == 403


def test_thematiques_non_choisies(key):
    r = client_for("dps").get(url(key, "/unchosen-modules"))
    assert r.status_code == 200 and r.json()["modules"][0]["code"] == "TS14"


def _seat_file():
    wb = Workbook()
    ws = wb.active
    ws.title = "Cameroun"
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    buf.name = "cle.xlsx"
    return buf


def test_imports(key):
    c = client_for("center_assistant")
    r = c.get("/api/v1/planning/imports/seat_allocations/template")
    assert r.status_code == 200
    assert load_workbook(io.BytesIO(r.content)).sheetnames[0] == "Cameroun"
    assert c.get("/api/v1/planning/imports/calendar_grid/template").status_code == 404
    assert c.get("/api/v1/planning/imports/inconnu/template").status_code == 404

    r = c.post("/api/v1/planning/imports/seat_allocations/preview", {"file": _seat_file()},
               format="multipart")
    assert r.status_code == 200 and "rows_read" in r.json()
    assert ImportLog.objects.count() == 0  # la prévisualisation n'écrit rien

    r = c.post("/api/v1/planning/imports/calendar_grid/preview", {"file": _seat_file()},
               format="multipart")
    assert r.status_code == 400 and r.json()["error"]["code"] == "PARAM_REQUIRED"
    bad = io.BytesIO(b"x")
    bad.name = "cle.csv"
    r = c.post("/api/v1/planning/imports/sessions/preview", {"file": bad}, format="multipart")
    assert r.json()["error"]["code"] == "FILE_TYPE"

    r = c.post("/api/v1/planning/imports/seat_allocations/apply", {"file": _seat_file()},
               format="multipart")
    assert r.status_code in (200, 422)
    logs = c.get("/api/v1/planning/imports/").json()
    assert len(logs) == 1
    assert c.get(f"/api/v1/planning/imports/{logs[0]['id']}").json()["report"]

    reader = client_for("workshop_manager")
    assert reader.get("/api/v1/planning/imports/").status_code == 403
    assert reader.post("/api/v1/planning/imports/seat_allocations/apply", {"file": _seat_file()},
                       format="multipart").status_code == 403
