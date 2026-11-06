import datetime as dt
import io
from decimal import Decimal

import pytest
from openpyxl import load_workbook

from planning.clients.needs import NeedsData
from planning.exports import xlsx
from planning.models import CostKeyYear, PlannedAllocation, PlannedSession
from planning.services.cost_key import Mode
from planning.services.cost_key_freeze import freeze
from planning.services.cost_key_global import country_sheet, global_table
from planning.services.cost_key_setup import SetupError, bootstrap, update
from planning.models import FrozenKeyError
from referential.models import Country

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def academy(settings):
    settings.ACADEMY_SITE = "DOUALA"
    settings.ACADEMY_COUNTRY_CODE = "cm"


@pytest.fixture
def world(referential):
    ci = Country.objects.get(code="ci")
    key = CostKeyYear.objects.create(year=2026, pole="MOTORS", budget=Decimal(1000),
                                     trainee_lodging_cost=Decimal(100),
                                     trainer_lodging_cost=Decimal(50))
    key.enrolled_countries.set([referential["cm"], ci])

    def plan(code, brand, host, location, **seats):
        p = PlannedSession.objects.create(
            cost_key=key, brand=brand, code_norm=code, code_raw=code, title=f"Module {code}",
            country=host, location=location,
            start_date=dt.date(2026, 3, 2), end_date=dt.date(2026, 3, 6))
        for c, n in seats.items():
            PlannedAllocation.objects.create(planned_session=p,
                                             country=Country.objects.get(code=c), seats=n)
        return p

    plan("TS01", referential["toyota"], referential["cm"], "Douala", cm=6, ci=2)
    plan("OM01", referential["omoda"], ci, "Abidjan", ci=2)
    return {**referential, "ci": ci, "key": key}


def needs():
    return NeedsData(available=True, source="quota_import", by_country={"cm": 12, "ci": 8},
                     by_cell={("cm", "toyota"): (12, 9), ("ci", "toyota"): (4, None),
                              ("ci", "omoda-jaecoo"): (4, 3)})


def test_global_pays_par_marque(world):
    table = global_table(world["key"], Mode.PLANNED, needs())
    assert [b["code"] for b in table["brands"]] == ["omoda-jaecoo", "toyota"]
    rows = {r["country"]: r for r in table["rows"]}
    assert rows["cm"]["cells"]["toyota"] == {"needs": 12, "technicians": 9, "seats": 6,
                                             "coverage": 0.5}
    assert rows["ci"]["cells"]["omoda-jaecoo"]["seats"] == 2
    assert rows["ci"]["technicians"] == 3  # effectif inconnu (Toyota) : ignoré, pas compté à 0
    assert rows["cm"]["key_cost"] + rows["ci"]["key_cost"] == 1000
    assert table["brand_totals"]["toyota"] == {"needs": 16, "technicians": 9, "seats": 8,
                                               "coverage": 0.5}
    assert table["partial"] is False


def test_global_filtre_les_pays_non_visibles(world):
    table = global_table(world["key"], Mode.PLANNED, needs(), visible={"ci"})
    assert [r["country"] for r in table["rows"]] == ["ci"] and table["partial"]


def test_global_sans_besoins(world):
    table = global_table(world["key"], Mode.PLANNED, NeedsData())
    row = next(r for r in table["rows"] if r["country"] == "cm")
    assert row["needs"] is None and row["coverage"] is None


def test_prevu_d_une_cle_gelee_lu_dans_le_snapshot(world):
    key = world["key"]
    freeze(key, "dg")
    key.refresh_from_db()
    before = global_table(key, Mode.PLANNED, needs())
    # Le référentiel change après le gel : la facture ne bouge pas.
    Country.objects.filter(code="ci").update(label="RCI renommée")
    after = global_table(key, Mode.PLANNED, needs())
    assert [r["key_cost"] for r in before["rows"]] == [r["key_cost"] for r in after["rows"]]


def test_fiche_pays(world):
    sheet = country_sheet(world["key"], Mode.PLANNED, "ci", {"ci": 8})
    assert [s["code"] for s in sheet["sessions"]] == ["OM01", "TS01"]
    assert sheet["footer"]["seats"] == 4 and sheet["footer"]["coverage"] == 0.5
    assert sheet["footer"]["trainee_lodging"] == 200  # 2 places à Douala
    assert country_sheet(world["key"], Mode.PLANNED, "xx") is None


def test_classeur_complet(world):
    table = global_table(world["key"], Mode.PLANNED, needs())
    sheets = [country_sheet(world["key"], Mode.PLANNED, c) for c in ("cm", "ci")]
    wb = load_workbook(io.BytesIO(xlsx.full_workbook(table, sheets)))
    assert wb.sheetnames == ["GLOBAL", "Cameroun", "Côte d'Ivoire"]
    ws = wb["GLOBAL"]
    assert ws.freeze_panes == "B3" and ws.auto_filter.ref
    last = ws.max_row
    assert ws.cell(row=last, column=1).value == "TOTAL"
    assert ws.cell(row=last, column=7).value == f"=SUM(G3:G{last - 1})"
    en = load_workbook(io.BytesIO(xlsx.global_workbook(table, "en")))["GLOBAL"]
    assert en.cell(row=2, column=1).value == "Country"


def test_amorcer_reprend_l_annee_precedente(world):
    key, created = bootstrap(2027, "MOTORS", {"budget": "1200"})
    assert created and key.budget == 1200 and key.trainee_lodging_cost == 100
    assert set(key.enrolled_countries.values_list("code", flat=True)) == {"cm", "ci"}
    again, created = bootstrap(2027, "MOTORS", {"budget": "1"})
    assert not created and again.budget == 1200  # créer seulement


def test_amorcer_sans_precedent_exige_le_budget(db):
    with pytest.raises(SetupError) as exc:
        bootstrap(2026, "EQUIPMENT")
    assert exc.value.code == "BUDGET_REQUIRED"


def test_regler_une_cle_gelee_refuse(world):
    key = world["key"]
    freeze(key, "dg")
    key.refresh_from_db()
    with pytest.raises(FrozenKeyError):
        update(key, {"budget": 5})
    with pytest.raises(SetupError):
        update(CostKeyYear.objects.create(year=2030, pole="MOTORS", budget=1), {"budget": "-3"})
