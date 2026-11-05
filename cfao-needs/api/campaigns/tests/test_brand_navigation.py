"""Le parcours filiale en trois écrans : connexion, BU + marques, formations.

L'entrée se fait par la marque et non par une grille unique à filtrer. Ces tests
verrouillent les deux points qui cassent ce parcours en silence : un compteur qui
promet plus de formations que la page marque n'en sert, et une formation sans
marque qui devient inatteignable.
"""
import pytest
from rest_framework.test import APIRequestFactory, force_authenticate

from campaigns.models import Campaign, CatalogLine, NeedLine, Submission
from campaigns.views import campaign_brands, campaign_catalog, campaign_my_submission
from core.auth.principal import Principal
from referential.models import Brand, CatalogFamily, OrgUnitRef, Pole, UserProfile

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def allow_everything(monkeypatch):
    """Le périmètre Cerbos est testé ailleurs — ici on regarde le regroupement."""
    monkeypatch.setattr(
        "core.authz.cerbos.plan", lambda *args, **kwargs: {"kind": "KIND_ALWAYS_ALLOWED"}
    )
    monkeypatch.setattr("core.authz.cerbos.check", lambda *args, **kwargs: True)


@pytest.fixture
def campaign():
    return Campaign.objects.create(
        year=2027, label="Identification des Besoins en Formations 2027",
        status=Campaign.Status.OPEN,
    )


@pytest.fixture
def douala():
    return OrgUnitRef.objects.create(
        code="cmr-douala", label="CFAO Cameroun — Douala", country="Cameroun",
        org_path=["groupe", "groupe.cmr", "groupe.cmr.douala"],
    )


@pytest.fixture
def manager(douala):
    return UserProfile.objects.create(
        keycloak_sub="sub-manager", email="chef.atelier@filiale-cmr.example",
        display_name="Chef d'atelier Douala", org_unit=douala,
        roles=["team_manager"], locale="fr",
    )


TECHNIQUE = CatalogFamily.Section.TECHNIQUE
PROCESS = CatalogFamily.Section.PROCESS


@pytest.fixture
def catalogue(campaign):
    """Deux marques dans un pôle, une dans l'autre, plus une ligne transverse.

    TOYOTA porte des lignes dans les DEUX sections : c'est le cas qui distingue un
    regroupement par section d'un simple regroupement par pôle.
    """
    technique = CatalogFamily.objects.create(
        key="technique-vl", label="Technique VL", pole=Pole.MOBILITY,
        section=TECHNIQUE, status=CatalogFamily.Status.READY,
    )
    engins = CatalogFamily.objects.create(
        key="technique-engins", label="Technique Engins", pole=Pole.EQUIPMENT,
        section=TECHNIQUE, status=CatalogFamily.Status.READY,
    )
    process = CatalogFamily.objects.create(
        key="process-sav", label="Process SAV", pole=Pole.MOBILITY,
        section=PROCESS, has_brands=False, status=CatalogFamily.Status.READY,
    )
    process_parts = CatalogFamily.objects.create(
        key="process-parts", label="Process Parts", pole=Pole.MOBILITY,
        section=PROCESS, status=CatalogFamily.Status.READY,
    )

    toyota = Brand.objects.create(code="toyota", label="TOYOTA", pole=Pole.MOBILITY, sort_order=1)
    suzuki = Brand.objects.create(code="suzuki", label="SUZUKI", pole=Pole.MOBILITY, sort_order=2)
    jcb = Brand.objects.create(code="jcb", label="JCB", pole=Pole.EQUIPMENT, sort_order=1)
    # Marque du groupe dont le catalogue n'est pas encore livré : aucune ligne.
    Brand.objects.create(code="yamaha", label="YAMAHA", pole=Pole.MOBILITY, sort_order=3)

    lines = {
        "toyota": [
            CatalogLine.objects.create(
                campaign=campaign, family=technique, brand=toyota,
                code=f"TS0{i}", title=f"Toyota {i}", tier=tier,
            )
            for i, tier in enumerate(["JUNIOR", "SENIOR", "EXPERT"], start=1)
        ],
        "suzuki": [
            CatalogLine.objects.create(
                campaign=campaign, family=technique, brand=suzuki,
                code="SS01", title="Suzuki 1", tier="JUNIOR",
            )
        ],
        "jcb": [
            CatalogLine.objects.create(
                campaign=campaign, family=engins, brand=jcb,
                code="JCB01", title="JCB 1", tier="SENIOR",
            )
        ],
        "toyota-parts": [
            CatalogLine.objects.create(
                campaign=campaign, family=process_parts, brand=toyota,
                code="TP10", title="Magasin pièces Toyota", tier="",
            )
        ],
        "transverse": [
            CatalogLine.objects.create(
                campaign=campaign, family=process, brand=None,
                code="TP02", title="Accueil atelier", tier="",
            )
        ],
    }
    return lines


def _call(view, campaign, manager, params=None, method="get"):
    factory = APIRequestFactory()
    request = getattr(factory, method)(f"/campaigns/{campaign.id}/x", params or {})
    force_authenticate(request, user=Principal(id=manager.keycloak_sub, roles=["team_manager"]))
    return view(request, pk=campaign.id)


def _by_section(body):
    """{section: {pôle: groupe}} — la charge utile est imbriquée sur deux niveaux."""
    return {
        group["section"]: {pole["pole"]: pole for pole in group["poles"]}
        for group in body
    }


# ── écran 2 : BU et marques ──────────────────────────────────────────────────


def test_les_marques_sont_groupees_par_section_puis_par_bu(campaign, manager, catalogue):
    body = _call(campaign_brands, campaign, manager).data

    # La technique passe avant le process : c'est l'ordre de lecture de l'écran.
    assert [group["section"] for group in body] == [TECHNIQUE, PROCESS]

    sections = _by_section(body)
    assert set(sections[TECHNIQUE]) == {Pole.MOBILITY, Pole.EQUIPMENT}
    assert set(sections[PROCESS]) == {Pole.MOBILITY}

    motors = sections[TECHNIQUE][Pole.MOBILITY]["brands"]
    assert [brand["label"] for brand in motors] == ["TOYOTA", "SUZUKI", "YAMAHA"]
    assert [brand["code"] for brand in sections[TECHNIQUE][Pole.EQUIPMENT]["brands"]] == ["jcb"]


def test_une_marque_sans_catalogue_reste_visible_mais_non_saisissable(
    campaign, manager, catalogue
):
    """Yamaha fait partie du groupe : la masquer laisserait croire qu'on ne la forme pas.

    Elle est annoncée à zéro formation, ce qui interdit au front d'en faire un lien
    vers une grille vide.
    """
    sections = _by_section(_call(campaign_brands, campaign, manager).data)
    motors = sections[TECHNIQUE][Pole.MOBILITY]["brands"]

    yamaha = next(brand for brand in motors if brand["code"] == "yamaha")
    assert yamaha["pending"] is True
    assert yamaha["trainings"] == 0
    # Les marques réellement au catalogue ne sont pas marquées en attente.
    assert all(not brand["pending"] for brand in motors if brand["code"] != "yamaha")
    # Une marque en attente n'ajoute rien au total annoncé sur la carte.
    assert sections[TECHNIQUE][Pole.MOBILITY]["trainings"] == 4


def test_aucune_carte_nest_inventee_pour_un_pole_absent_de_la_section(
    campaign, manager, catalogue
):
    """Le pôle Equipment n'a pas de famille process ici : pas de carte process Equipment."""
    sections = _by_section(_call(campaign_brands, campaign, manager).data)
    assert Pole.EQUIPMENT not in sections[PROCESS]


def test_une_marque_compte_separement_dans_chaque_section(campaign, manager, catalogue):
    """TOYOTA n'a pas les mêmes formations en technique et en process.

    Un total unique par marque enverrait vers une grille qui ne correspond pas au
    chiffre annoncé sur la carte cliquée.
    """
    sections = _by_section(_call(campaign_brands, campaign, manager).data)

    def toyota(section):
        brands = sections[section][Pole.MOBILITY]["brands"]
        return next(brand for brand in brands if brand["code"] == "toyota")

    assert toyota(TECHNIQUE)["trainings"] == 3
    assert toyota(PROCESS)["trainings"] == 1


def test_les_formations_sans_marque_restent_atteignables(campaign, manager, catalogue):
    """Sans entrée transverse, `TP02` deviendrait invisible dans une navigation par marque."""
    sections = _by_section(_call(campaign_brands, campaign, manager).data)
    process = sections[PROCESS][Pole.MOBILITY]

    transverse = [brand for brand in process["brands"] if brand["is_transverse"]]
    assert len(transverse) == 1
    assert transverse[0]["trainings"] == 1
    # Le transverse ferme la liste, y compris derrière les marques en attente :
    # c'est un repli, pas une marque.
    assert process["brands"][-1]["is_transverse"] is True


def test_le_compteur_annonce_exactement_ce_que_la_page_marque_servira(
    campaign, manager, catalogue
):
    body = _call(campaign_brands, campaign, manager).data

    for group in body:
        for pole in group["poles"]:
            for brand in pole["brands"]:
                params = {"brand": brand["code"], "section": group["section"]}
                if brand["is_transverse"]:
                    params["pole"] = pole["pole"]
                servi = _call(campaign_catalog, campaign, manager, params).data
                assert len(servi) == brand["trainings"], (group["section"], brand["code"])


def test_le_compteur_de_collaborateurs_suit_la_saisie(campaign, manager, catalogue, douala):
    submission = Submission.objects.create(campaign=campaign, org_unit=douala)
    NeedLine.objects.create(
        submission=submission, catalog_line=catalogue["toyota"][0], q1=3, q3=2
    )

    sections = _by_section(_call(campaign_brands, campaign, manager).data)
    motors = sections[TECHNIQUE][Pole.MOBILITY]
    toyota = next(brand for brand in motors["brands"] if brand["code"] == "toyota")

    assert toyota["headcount"] == 5
    assert toyota["trainings_selected"] == 1
    assert motors["headcount"] == 5
    # La saisie technique ne doit pas remonter dans le compteur process.
    process_toyota = next(
        brand for brand in sections[PROCESS][Pole.MOBILITY]["brands"]
        if brand["code"] == "toyota"
    )
    assert process_toyota["headcount"] == 0


# ── écran 3 : formations d'une marque ────────────────────────────────────────


def test_la_page_marque_ne_sert_que_sa_marque(campaign, manager, catalogue):
    body = _call(campaign_catalog, campaign, manager, {"brand": "toyota"}).data
    assert {line["code"] for line in body} == {"TS01", "TS02", "TS03", "TP10"}


def test_la_page_marque_ne_sert_que_la_section_ouverte(campaign, manager, catalogue):
    """Ouvrir TOYOTA depuis la carte technique ne doit pas servir ses lignes process."""
    technique = _call(
        campaign_catalog, campaign, manager, {"brand": "toyota", "section": TECHNIQUE}
    ).data
    process = _call(
        campaign_catalog, campaign, manager, {"brand": "toyota", "section": PROCESS}
    ).data

    assert {line["code"] for line in technique} == {"TS01", "TS02", "TS03"}
    assert {line["code"] for line in process} == {"TP10"}


def test_le_transverse_est_borne_a_son_pole(campaign, manager, catalogue):
    body = _call(
        campaign_catalog, campaign, manager,
        {"brand": "__transverse__", "pole": Pole.EQUIPMENT},
    ).data
    assert body == []


# ── ouverture de la fiche ────────────────────────────────────────────────────


def test_la_fiche_souvre_une_seule_fois(campaign, manager):
    first = _call(campaign_my_submission, campaign, manager, method="post")
    second = _call(campaign_my_submission, campaign, manager, method="post")

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.data["id"] == second.data["id"]
    assert Submission.objects.filter(campaign=campaign).count() == 1


def test_un_compte_sans_filiale_nouvre_pas_de_fiche(campaign):
    orphan = UserProfile.objects.create(
        keycloak_sub="sub-academy", email="assistante@cfao.com",
        display_name="Assistante centre", roles=["center_assistant"],
    )
    response = _call(campaign_my_submission, campaign, orphan, method="post")

    assert response.status_code == 400
    assert Submission.objects.count() == 0


def test_un_role_en_lecture_seule_nouvre_pas_de_fiche(campaign, manager, monkeypatch):
    """Le droit d'ouvrir reste une décision du PDP, pas une déduction du profil."""
    monkeypatch.setattr("core.authz.cerbos.check", lambda *args, **kwargs: False)

    response = _call(campaign_my_submission, campaign, manager, method="post")

    assert response.status_code == 403
    assert Submission.objects.count() == 0


def test_une_campagne_fermee_nouvre_pas_de_fiche(campaign, manager):
    campaign.status = Campaign.Status.CLOSED
    campaign.save(update_fields=["status"])

    response = _call(campaign_my_submission, campaign, manager, method="post")

    assert response.status_code == 409
    assert Submission.objects.count() == 0
