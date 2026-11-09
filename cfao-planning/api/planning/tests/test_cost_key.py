import datetime as dt
from decimal import Decimal

import pytest
from django.db import IntegrityError

from planning.models import CostKeyYear, SeatAllocation, Session, SessionAssignment, SessionStatus
from planning.services.cost_key import Mode, compute
from referential.models import Country, Trainer

pytestmark = pytest.mark.django_db

LODGING = Decimal(1_800_000)
ACTUAL = Mode.ACTUAL


@pytest.fixture(autouse=True)
def academy(settings):
    settings.ACADEMY_SITE = "DOUALA"
    settings.ACADEMY_COUNTRY_CODE = "cm"


@pytest.fixture
def world(referential):
    ci = Country.objects.get(code="ci")
    sn = Country.objects.create(code="sn", label="Sénégal", org_path=["cfao", "sn"])
    key = CostKeyYear.objects.create(year=2026, pole="MOTORS", budget=Decimal(1000),
                                     trainee_lodging_cost=LODGING, trainer_lodging_cost=LODGING)
    key.enrolled_countries.set([referential["cm"], ci])
    return {**referential, "ci": ci, "sn": sn, "key": key}


def session(world, code, country, location="", status=SessionStatus.PLANNED, trainers=()):
    s = Session.objects.create(
        year=2026, brand=world["toyota"], training_type="TECHNIQUE", code_norm=code,
        title=code, country=country, location=location, status=status,
        start_date=dt.date(2026, 3, 2), end_date=dt.date(2026, 3, 6), days=5,
    )
    for trainer in trainers:
        SessionAssignment.objects.create(session=s, trainer=trainer)
    return s


def allocate(s, **seats):
    for code, n in seats.items():
        SeatAllocation.objects.create(session=s, country=Country.objects.get(code=code), seats=n)


def by_code(report):
    return {line.code: line for line in report.lines}


def test_part_et_cout_cle_sur_les_pays_enroles(world):
    s = session(world, "TS01", world["cm"], "Douala")
    allocate(s, cm=6, ci=3, sn=1)
    report = compute(world["key"], mode=ACTUAL)
    lines = by_code(report)
    assert report.total_seats == 9  # sn n'est pas enrôlé en 2026
    assert lines["cm"].share == Decimal(6) / 9
    assert lines["cm"].key_cost + lines["ci"].key_cost == Decimal(1000)
    assert (lines["cm"].key_cost, lines["ci"].key_cost) == (Decimal(667), Decimal(333))
    assert not lines["sn"].enrolled and lines["sn"].key_cost == 0
    assert lines["sn"].seats == 1  # visible, hors clé


def test_somme_des_parts_egale_le_budget_sans_ecart_d_arrondi(world):
    world["key"].enrolled_countries.add(world["sn"])
    s = session(world, "TS01", world["cm"], "Douala")
    allocate(s, cm=1, ci=1, sn=1)
    report = compute(world["key"], mode=ACTUAL)
    assert sum(line.key_cost for line in report.lines) == Decimal(1000)


def test_hebergement_stagiaires_seulement_a_douala(world):
    allocate(session(world, "TS01", world["cm"], "Douala"), ci=3)
    allocate(session(world, "TS02", world["ci"], "Abidjan"), ci=4)
    line = by_code(compute(world["key"], mode=ACTUAL))["ci"]
    assert line.seats == 7 and line.academy_seats == 3
    assert line.trainee_lodging == 3 * LODGING


def test_session_sans_lieu_au_cameroun_compte_comme_douala(world):
    allocate(session(world, "TS01", world["cm"]), ci=2)
    assert by_code(compute(world["key"], mode=ACTUAL))["ci"].academy_seats == 2


def test_hebergement_formateur_hors_douala_mais_pas_pour_un_technicien_instructeur(world):
    eugene = world["eugene"]
    pic = Trainer.objects.create(full_name="PIC", name_norm="PIC", service="MOTORS",
                                 kind=Trainer.Kind.TECH_INSTRUCTOR)
    session(world, "TS01", world["ci"], "Abidjan", trainers=[eugene])
    session(world, "TS02", world["ci"], "Abidjan", trainers=[pic])
    session(world, "TS03", world["cm"], "Douala", trainers=[eugene])
    lines = by_code(compute(world["key"], mode=ACTUAL))
    assert lines["ci"].trainer_sessions == 1
    assert lines["ci"].trainer_lodging == LODGING
    assert lines["cm"].trainer_lodging == 0


def test_sessions_annulees_ou_reportees_ignorees(world):
    allocate(session(world, "TS01", world["cm"], "Douala", status=SessionStatus.CANCELLED), cm=5)
    allocate(session(world, "TS02", world["cm"], "Douala", status=SessionStatus.POSTPONED), ci=5)
    report = compute(world["key"], mode=ACTUAL)
    assert report.total_seats == 0 and report.hourly_cost is None


def test_autre_annee_et_autre_pole_hors_perimetre(world):
    s = session(world, "TS01", world["cm"], "Douala")
    allocate(s, cm=4)
    CostKeyYear.objects.create(year=2025, pole="MOTORS", budget=Decimal(500))
    other = CostKeyYear.objects.get(year=2025)
    assert compute(other, mode=ACTUAL).total_seats == 0
    assert compute(world["key"], mode=ACTUAL).total_seats == 4


def test_cout_horaire_et_total(world):
    allocate(session(world, "TS01", world["cm"], "Douala"), ci=5)
    report = compute(world["key"], mode=ACTUAL)
    assert report.hourly_cost == Decimal(1000) / (5 * 40)
    ci = by_code(report)["ci"]
    assert ci.total == Decimal(1000) + 5 * LODGING


def test_pas_d_hebergement_pour_les_techniciens_du_pays_de_l_academy(world):
    allocate(session(world, "TS01", world["cm"], "Douala"), cm=4, ci=2)
    lines = by_code(compute(world["key"], mode=ACTUAL))
    assert lines["cm"].seats == 4 and lines["cm"].academy_seats == 0
    assert lines["cm"].trainee_lodging == 0
    assert lines["ci"].trainee_lodging == 2 * LODGING


def test_formateur_de_filiale_ne_se_loge_pas_chez_lui(world):
    local = Trainer.objects.create(full_name="LOCAL", name_norm="LOCAL", service="MOTORS",
                                   home_country=world["ci"])
    session(world, "TS01", world["ci"], "Abidjan", trainers=[local])
    session(world, "TS02", world["sn"], "Dakar", trainers=[local])
    session(world, "TS03", world["cm"], "Yaounde", trainers=[local])
    lines = by_code(compute(world["key"], mode=ACTUAL))
    assert lines["ci"].trainer_sessions == 0
    assert lines["sn"].trainer_sessions == 1
    assert lines["cm"].trainer_sessions == 1  # hors de son pays, même au Cameroun


def test_couverture_depuis_les_besoins_fournis(world):
    allocate(session(world, "TS01", world["cm"], "Douala"), cm=5, ci=2)
    lines = by_code(compute(world["key"], needs={"cm": 10, "ci": 0}, mode=ACTUAL))
    assert lines["cm"].coverage == Decimal("0.5")
    assert lines["ci"].coverage is None  # pas de besoin exprimé : pas de division


def test_allocation_unique_par_session_et_pays(world):
    s = session(world, "TS01", world["cm"], "Douala")
    allocate(s, cm=2)
    with pytest.raises(IntegrityError):
        allocate(s, cm=1)
