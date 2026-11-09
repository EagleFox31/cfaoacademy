import datetime as dt
import io
from decimal import Decimal

import pytest
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

from planning.clients.needs import NeedsData
from planning.exports import xlsx
from planning.models import CostKeyYear, PlannedAllocation, PlannedSession
from planning.services.cost_key import Mode
from planning.services.cost_key_abc import abc_table, consolidate_abc
from planning.services.cost_key_freeze import freeze, inputs_sha256
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
    heads = [c.value for c in ws[2]]
    # Ordre de « TOUS LES PAYS » : marques juste après les techniciens, l'argent en dernier.
    assert heads[:2] == ["Pays", "Techniciens"] and heads[-1] == "Total à payer"
    assert heads.index("Coût clé") > max(i for i, h in enumerate(heads) if "·" in h)
    col = get_column_letter(heads.index("Coût clé") + 1)
    assert ws[f"{col}{last}"].value == f"=SUM({col}3:{col}{last - 1})"
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


def test_fiche_pays_hebergements_par_ligne(world):
    sheet = country_sheet(world["key"], Mode.PLANNED, "ci")
    lines = {s["code"]: s for s in sheet["sessions"]}
    assert lines["TS01"]["trainee_lodging"] == 200 and lines["OM01"]["trainee_lodging"] == 0
    for name in ("trainee_lodging", "trainer_lodging"):
        assert sum(s[name] for s in sheet["sessions"]) == sheet["footer"][name]


def test_abc_trois_bases(world):
    table = abc_table(world["key"], needs())
    rows = {r["country"]: r for r in table["rows"]}
    assert (rows["cm"]["a"], rows["cm"]["b"], rows["cm"]["c"]) == (6, 12, 9)
    assert (rows["ci"]["a"], rows["ci"]["b"], rows["ci"]["c"]) == (4, 8, 3)
    assert rows["cm"]["cells"]["toyota"] == {"a": 6, "b": 12, "c": 9, "a_b": 0.5,
                                             "a_c": 0.6667}
    for base in ("a", "b", "c"):
        assert sum(r[f"amount_{base}"] for r in table["rows"]) == 1000
    assert (rows["cm"]["amount_a"], rows["cm"]["amount_c"]) == (600, 750)
    assert table["totals"] == {"a": 10, "b": 20, "c": 12}


def test_abc_sans_besoins_ni_zero(world):
    table = abc_table(world["key"], NeedsData(warnings=[{"code": "needs_unavailable"}]))
    row = next(r for r in table["rows"] if r["country"] == "cm")
    assert row["a"] == 6 and row["b"] is None and row["c"] is None
    assert row["amount_b"] is None and row["amount_a"] == 600
    assert table["warnings"] == [{"code": "needs_unavailable"}]


def test_abc_filtre_mais_garde_les_vraies_parts(world):
    table = abc_table(world["key"], needs(), visible={"ci"})
    assert [r["country"] for r in table["rows"]] == ["ci"] and table["partial"]
    assert table["rows"][0]["amount_a"] == 400


def test_abc_tous_poles(world):
    one = abc_table(world["key"], needs())
    merged = consolidate_abc([one, one])
    cm = next(r for r in merged["rows"] if r["country"] == "cm")
    assert cm["a"] == 12 and cm["amount_a"] == 1200 and cm["share_a"] == 0.6
    assert merged["pole"] == "ALL" and merged["budget"] == 2000


def test_taux_horaire_saisi(world):
    key = update(world["key"], {"hourly_rate": "2500"})
    assert key.hourly_rate == 2500
    assert global_table(key, Mode.PLANNED, needs())["hourly_rate"] == 2500
    nxt, _ = bootstrap(2027, "MOTORS")
    assert nxt.hourly_rate == 2500  # repris de l'année précédente
    assert update(key, {"hourly_rate": None}).hourly_rate is None  # null efface
    assert update(key, {"budget": 1000}).hourly_rate is None  # absent : inchangé
    with pytest.raises(SetupError):
        update(key, {"hourly_rate": "1.5"})


def test_cle_tarifee_paie_places_x_heures_x_taux(world):
    """Tarif 2027 : 10 000 par technicien et par heure, 40 h → 400 000 la place."""
    key = update(world["key"], {"hourly_rate": 10000, "hours_per_session": 40})
    table = global_table(key, Mode.PLANNED, needs())
    rows = {r["country"]: r for r in table["rows"]}
    assert rows["cm"]["key_cost"] == 6 * 400_000 and rows["ci"]["key_cost"] == 4 * 400_000
    assert table["budget"] == 10 * 400_000  # le budget découle des places
    assert table["hourly_cost"] == 10000
    abc = abc_table(key, needs())
    assert {r["country"]: r["amount_a"] for r in abc["rows"]} == {"cm": 2_400_000,
                                                                   "ci": 1_600_000}
    assert abc["budget"] == 4_000_000
    freeze(key, "dg")  # le réparti égale le budget effectif


def test_taux_horaire_dans_l_empreinte_seulement_s_il_est_saisi(world):
    key = world["key"]
    before = inputs_sha256(key)
    update(key, {"hourly_rate": None})
    assert inputs_sha256(key) == before  # clé à budget : empreinte inchangée
    update(key, {"hourly_rate": 3000})
    assert inputs_sha256(key) != before  # clé tarifée : le taux fixe les montants
    freeze(key, "dg")
    key.refresh_from_db()
    with pytest.raises(FrozenKeyError):
        update(key, {"hourly_rate": 1})
    key.hourly_rate = 1
    with pytest.raises(FrozenKeyError):
        key.save()


def test_regler_une_cle_gelee_refuse(world):
    key = world["key"]
    freeze(key, "dg")
    key.refresh_from_db()
    with pytest.raises(FrozenKeyError):
        update(key, {"budget": 5})
    with pytest.raises(SetupError):
        update(CostKeyYear.objects.create(year=2030, pole="MOTORS", budget=1), {"budget": "-3"})
