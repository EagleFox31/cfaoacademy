import datetime as dt
from decimal import Decimal

import pytest
from django.core.management import call_command
from django.db import transaction

from planning.models import (
    CostKeySnapshot, CostKeyYear, FrozenKeyError, PlannedAllocation, PlannedSession,
)
from planning.services.cost_key import CostKeyReport, Mode, compute
from planning.services.cost_key_freeze import FreezeRefused, freeze
from referential.models import Country

pytestmark = pytest.mark.django_db

LODGING = Decimal(1_800_000)


@pytest.fixture(autouse=True)
def academy(settings):
    settings.ACADEMY_SITE = "DOUALA"
    settings.ACADEMY_COUNTRY_CODE = "cm"


@pytest.fixture
def world(referential):
    ci = Country.objects.get(code="ci")
    key = CostKeyYear.objects.create(year=2026, pole="MOTORS", budget=Decimal(1000),
                                     trainee_lodging_cost=LODGING, trainer_lodging_cost=LODGING)
    key.enrolled_countries.set([referential["cm"], ci])
    return {**referential, "ci": ci, "key": key}


def plan(world, code, host, location="", trainers=(), **seats):
    p = PlannedSession.objects.create(
        cost_key=world["key"], brand=world["toyota"], code_norm=code, country=host,
        location=location, start_date=dt.date(2026, 3, 2), end_date=dt.date(2026, 3, 6),
    )
    p.trainers.set(trainers)
    for code_, n in seats.items():
        PlannedAllocation.objects.create(planned_session=p, country=Country.objects.get(code=code_),
                                         seats=n)
    return p


@pytest.fixture
def frozen(world):
    plan(world, "TS01", world["cm"], "Douala", cm=6, ci=3)
    plan(world, "TS02", world["ci"], "Abidjan", trainers=[world["eugene"]], ci=2)
    snapshot = freeze(world["key"], "dg")
    world["key"].refresh_from_db()
    return snapshot


def test_snapshot_egal_au_calcul_du_prevu(world, frozen):
    key = world["key"]
    assert (key.status, key.frozen_by) == ("FROZEN", "dg")
    report = CostKeyReport.from_dict(frozen.report)
    assert report == compute(key, mode=Mode.PLANNED)
    assert report.mode == Mode.PLANNED
    lines = {l.code: l for l in report.lines}
    assert lines["ci"].trainer_lodging == LODGING  # Eugène loge à Abidjan
    assert lines["ci"].trainee_lodging == 3 * LODGING


def test_double_gel_idempotent(world, frozen):
    assert freeze(world["key"], "autre") == frozen
    assert CostKeySnapshot.objects.count() == 1


def test_commande_de_gel_idempotente(world):
    plan(world, "TS01", world["cm"], "Douala", cm=1)
    call_command("freeze_cost_key", year=2026, pole="MOTORS")
    call_command("freeze_cost_key", year=2026, pole="MOTORS")
    assert CostKeySnapshot.objects.count() == 1


def test_gel_d_une_cle_vide_refuse(world):
    with pytest.raises(FreezeRefused, match="aucune session"):
        freeze(world["key"], "dg")
    assert world["key"].status == "DRAFT"


def test_gel_refuse_si_le_budget_n_est_pas_reparti(world):
    plan(world, "TS01", world["cm"], "Douala")  # aucune place
    with pytest.raises(FreezeRefused, match="budget"):
        freeze(world["key"], "dg")
    assert not CostKeySnapshot.objects.exists()


def test_prevu_gele_immuable(world, frozen):
    planned = PlannedSession.objects.get(code_norm="TS01")
    allocation = planned.allocations.first()
    with pytest.raises(FrozenKeyError):
        planned.save()
    with pytest.raises(FrozenKeyError):
        planned.delete()
    with pytest.raises(FrozenKeyError):
        PlannedSession.objects.update(location="Kribi")
    with pytest.raises(FrozenKeyError):
        PlannedSession.objects.all().delete()
    with pytest.raises(FrozenKeyError):
        PlannedAllocation.objects.filter(pk=allocation.pk).update(seats=9)
    with pytest.raises(FrozenKeyError):
        allocation.delete()
    with pytest.raises(FrozenKeyError), transaction.atomic():
        planned.trainers.add(world["lucien"])
    with pytest.raises(FrozenKeyError):
        plan(world, "TS09", world["cm"], cm=1)
    assert PlannedAllocation.objects.get(pk=allocation.pk).seats == allocation.seats


def test_parametres_de_la_cle_geles(world, frozen):
    key = world["key"]
    key.budget = Decimal(2000)
    with pytest.raises(FrozenKeyError):
        key.save()
    key.refresh_from_db()
    key.status = "DRAFT"
    with pytest.raises(FrozenKeyError):
        key.save()
    sn = Country.objects.create(code="sn", label="Sénégal", org_path=["cfao", "sn"])
    # Les M2M écrivent dans un atomic : on isole chaque refus dans le sien.
    with pytest.raises(FrozenKeyError), transaction.atomic():
        CostKeyYear.objects.get().enrolled_countries.add(sn)
    with pytest.raises(FrozenKeyError), transaction.atomic():
        sn.cost_key_years.add(world["key"])
    with pytest.raises(FrozenKeyError), transaction.atomic():
        world["cm"].cost_key_years.clear()
    assert world["key"].enrolled_countries.count() == 2


def test_snapshot_immuable(frozen):
    with pytest.raises(FrozenKeyError):
        frozen.save()
    with pytest.raises(FrozenKeyError):
        frozen.delete()
    with pytest.raises(FrozenKeyError):
        CostKeySnapshot.objects.update(created_by="x")
    with pytest.raises(FrozenKeyError):
        CostKeySnapshot.objects.all().delete()


def test_referentiel_modifie_apres_gel_snapshot_et_prevu_inchanges(world, frozen):
    eugene = world["eugene"]
    eugene.home_country = world["ci"]  # il ne se loge plus à Abidjan
    eugene.save()
    live = {l.code: l for l in compute(world["key"], mode=Mode.PLANNED).lines}
    assert live["ci"].trainer_lodging == 0
    stored = {l.code: l for l in CostKeyReport.from_dict(
        CostKeySnapshot.objects.get().report).lines}
    assert stored["ci"].trainer_lodging == LODGING
    # Le prévu n'a pas bougé : regeler est toujours idempotent.
    assert freeze(world["key"], "dg") == frozen
