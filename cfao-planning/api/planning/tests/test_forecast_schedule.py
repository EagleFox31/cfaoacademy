"""Dates et formateurs du prévisionnel lus dans la grille, calculés à la lecture."""
import datetime as dt
import hashlib
from decimal import Decimal

import pytest

from planning.models import CostKeyYear, GridBand, PlannedAllocation, PlannedSession
from planning.services.forecast_schedule import parse_band, plan_for_key, schedule_for_key

pytestmark = pytest.mark.django_db
ORANGE, YELLOW = "rgb:FFFFC000", "rgb:FFFFFF00"
KNOWN = {"TS07-G3", "TS03-G3", "SS-DIAG-01", "TS01A-G4", "SNM01", "SNM02", "SNM03", "LVL17",
         "SS08", "SS08-GOLD"}


@pytest.mark.parametrize("text, codes", [
    ("TS03-G3-Tchad", ["TS03-G3"]),
    ("TS07-G3 - TOYOTA- SENEGAL", ["TS07-G3"]),
    ("SS-DIAG-01 - RDC", ["SS-DIAG-01"]),
    ("TS01A-G4 - DESAUTEL", ["TS01A-G4"]),
    ("SNM01, 02, 03-Congo", ["SNM01", "SNM02", "SNM03"]),
    ("LVL17 - RDC Kinshasa", ["LVL17"]),
    ("SS08 - GOLD", ["SS08-GOLD"]),
    ("SS08", ["SS08"]),
    ("TS07", ["TS07-G3"]),
    ("YAMAHA CFR CAM", []),
])
def test_lecture_du_texte_de_bande(text, codes):
    assert parse_band(text, KNOWN).codes == codes


def test_segments_gardent_les_mots():
    assert "RDC Kinshasa" in parse_band("LVL17 - RDC Kinshasa", KNOWN).segments


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


def band(text, start, end, fill=ORANGE, trainer="Eugène EBENE", section="TOYOTA", cell="H4", pole="MOTORS"):
    return GridBand.objects.create(
        year=2027, pole=pole, sheet="Calendrier-MOBILITY", cell=cell, text=text, fill_key=fill,
        start_date=start, end_date=end, trainer_raw=trainer, section=section,
        fingerprint=hashlib.sha256(f"{text}{start}{cell}{trainer}".encode()).hexdigest(),
    )


def session(key, ref, code, country, seats_country=None, start=None, origin="needs_sheet",
            location=""):
    s = PlannedSession.objects.create(
        cost_key=key, brand=ref["toyota"], code_norm=code, country=ref[country],
        start_date=start, end_date=start, location=location, origin=origin,
    )
    PlannedAllocation.objects.create(planned_session=s, country=ref[seats_country or country], seats=2)
    return s


D = dt.date


def test_bande_filiale_donne_dates_et_formateur(key, referential):
    s = session(key, referential, "TS03-G3", "ci", location="Côte d'Ivoire")
    band("TS03-G3-RCI", D(2027, 1, 11), D(2027, 1, 15))
    band("TS03-G3 - Cameroun", D(2027, 2, 1), D(2027, 2, 5), cell="H9")  # autre pays
    slots = schedule_for_key(key)[str(s.pk)]
    assert [(x["start_date"], x["end_date"], x["trainers"]) for x in slots] == [
        (D(2027, 1, 11), D(2027, 1, 15), ["Eugène EBENE"])]


def test_douala_partage_entre_pays_et_tous_les_creneaux(key, referential):
    a = session(key, referential, "SNM01", "cm", seats_country="ci", location="Academy de Douala")
    b = session(key, referential, "SNM01", "cm", seats_country="cm", location="Academy de Douala")
    band("SNM01", D(2027, 3, 1), D(2027, 3, 5), fill=YELLOW)
    band("SNM01", D(2027, 6, 7), D(2027, 6, 11), fill=YELLOW, cell="H40")
    schedule = schedule_for_key(key)
    for s in (a, b):
        assert [x["start_date"] for x in schedule[str(s.pk)]] == [D(2027, 3, 1), D(2027, 6, 7)]


def test_session_datee_prend_le_creneau_le_plus_proche_et_le_retire(key, referential):
    dated = session(key, referential, "TS03-G3", "ci", start=D(2027, 6, 1), origin="workbook",
                    location="Côte d'Ivoire")
    undated = session(key, referential, "TS03-G3", "ci", origin="workbook", location="Côte d'Ivoire")
    band("TS03-G3-RCI", D(2027, 1, 11), D(2027, 1, 15))
    band("TS03-G3-RCI", D(2027, 6, 7), D(2027, 6, 11), cell="H50")
    schedule = schedule_for_key(key)
    assert [x["start_date"] for x in schedule[str(dated.pk)]] == [D(2027, 6, 7)]
    assert [x["start_date"] for x in schedule[str(undated.pk)]] == [D(2027, 1, 11)]


def test_pays_mal_ecrit_lu_quand_meme(key, referential):
    s = session(key, referential, "TS03-G3", "ci", location="Côte d'Ivoire")
    band("TS03-G3 - Côte d'Ivoiire", D(2027, 1, 11), D(2027, 1, 15))
    assert schedule_for_key(key)[str(s.pk)][0]["start_date"] == D(2027, 1, 11)


def test_co_animation_fusionnee(key, referential):
    s = session(key, referential, "TS03-G3", "ci", location="Côte d'Ivoire")
    band("TS03-G3-RCI", D(2027, 1, 11), D(2027, 1, 15))
    band("TS03-G3-RCI", D(2027, 1, 11), D(2027, 1, 15), trainer="Lucien GAGNE", cell="H7")
    slots = schedule_for_key(key)[str(s.pk)]
    assert len(slots) == 1 and slots[0]["trainers"] == ["Eugène EBENE", "Lucien GAGNE"]


def test_bande_coupee_au_changement_de_mois_recollee(key, referential):
    # La grille a une colonne par mois : une session du 30/08 au 03/09 y est deux bandes.
    s = session(key, referential, "TS06-G3", "ci", location="Côte d'Ivoire")
    band("TS06-G3-RCI", D(2027, 8, 30), D(2027, 8, 31), cell="D290")
    band("TS06-G3-RCI", D(2027, 9, 1), D(2027, 9, 3), trainer="Lucien GAGNE", cell="D295")
    band("TS06-G3-RCI", D(2027, 9, 6), D(2027, 9, 10), cell="D300")  # semaine suivante : 2e groupe
    slots = schedule_for_key(key)[str(s.pk)]
    assert [(x["start_date"], x["end_date"]) for x in slots] == [
        (D(2027, 8, 30), D(2027, 9, 3)), (D(2027, 9, 6), D(2027, 9, 10))]
    assert slots[0]["trainers"] == ["Eugène EBENE", "Lucien GAGNE"]


def test_formateur_inconnu_garde_son_nom_brut(key, referential):
    s = session(key, referential, "TS03-G3", "ci", location="Côte d'Ivoire")
    band("TS03-G3-RCI", D(2027, 1, 11), D(2027, 1, 15), trainer="Mohammed COLY")
    assert schedule_for_key(key)[str(s.pk)][0]["trainers"] == ["Mohammed COLY"]


def test_reportees_et_annulees_exclues(key, referential):
    s = session(key, referential, "TS03-G3", "ci", location="Côte d'Ivoire")
    band("TS03-G3-RCI", D(2027, 1, 11), D(2027, 1, 15), trainer="", section="FORMATIONS REPORTEES")
    band("TS03-G3-RCI", D(2027, 2, 1), D(2027, 2, 5), trainer="", section="FORMATIONS ANNULEES", cell="H9")
    assert str(s.pk) not in schedule_for_key(key)


def test_pays_inconnu_et_code_hors_cle_signales(key, referential):
    session(key, referential, "TS03-G3", "ci", location="Côte d'Ivoire")
    band("TS03-G3 - Atlantide", D(2027, 1, 11), D(2027, 1, 15))
    band("YAMAHA CFR CAM", D(2027, 2, 1), D(2027, 2, 5), cell="H9")
    schedule, unmatched = plan_for_key(key)
    assert schedule == {}
    assert len(unmatched) == 2


def test_cle_gelee_lue_sans_ecriture(key, referential):
    s = session(key, referential, "TS03-G3", "ci", location="Côte d'Ivoire")
    band("TS03-G3-RCI", D(2027, 1, 11), D(2027, 1, 15))
    CostKeyYear.objects.filter(pk=key.pk).update(status="FROZEN")
    key.refresh_from_db()
    assert schedule_for_key(key)[str(s.pk)][0]["start_date"] == D(2027, 1, 11)
    s.refresh_from_db()
    assert s.start_date is None


def test_autre_pole_ignore(key, referential):
    s = session(key, referential, "TS03-G3", "ci", location="Côte d'Ivoire")
    band("TS03-G3-RCI", D(2027, 1, 11), D(2027, 1, 15), pole="EQUIPMENT")
    assert str(s.pk) not in schedule_for_key(key)
