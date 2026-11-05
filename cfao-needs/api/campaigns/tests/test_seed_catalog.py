"""Le chemin de démonstration, vérifié de bout en bout.

`seed_referential` puis `seed_catalog` doivent produire une campagne prête à
ouvrir à partir du **vrai** fichier de travail 2027 — pas d'un jeu inventé.

Ces tests protègent la démonstration : si l'importeur casse, ils cassent aussi,
parce que le seed emprunte exactement le chemin d'un import réel.
"""
import json
from pathlib import Path

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from campaigns.models import Campaign, CatalogLine
from referential.models import Brand, BrandAlias, CatalogFamily, OrgUnitRef, UserProfile

pytestmark = pytest.mark.django_db

SOURCE = Path(__file__).resolve().parents[2] / "referential" / "data" / "catalog_2027.json"


@pytest.fixture
def seeded():
    call_command("seed_referential", verbosity=0)
    return Campaign.objects.get(year=2027)


def test_le_referentiel_charge_familles_marques_et_organisation(seeded):
    assert CatalogFamily.objects.count() == 8
    assert Brand.objects.count() == 21          # 10 Mobility + 10 Equipment + Yamaha
    assert OrgUnitRef.objects.count() == 7
    # 7 comptes de demonstration : un par role du parcours, coordonnateur inclus.
    assert UserProfile.objects.count() == 7
    assert seeded.status == Campaign.Status.DRAFT


def test_stellantis_est_bien_eclate_en_quatre_marques(seeded):
    assert not Brand.objects.filter(label__icontains="stellantis").exists()
    for label in ("CITROEN", "FIAT", "JEEP", "PEUGEOT"):
        assert Brand.objects.filter(label=label).exists(), label


def test_les_alias_de_marque_sont_des_donnees_pas_du_code(seeded):
    alias = BrandAlias.objects.get(alias="OMODA & JAECCO")
    assert alias.brand.label == "OMODA & JAECOO"
    assert BrandAlias.objects.get(alias="SINOTRUCK").brand.label == "SINOTRUK"


def test_aucun_compte_ne_porte_de_mot_de_passe(seeded):
    """Interdit n° 1 : Keycloak est seul dépositaire des identifiants."""
    champs = {f.name for f in UserProfile._meta.get_fields()}
    assert not {c for c in champs if "password" in c.lower()}


def test_le_catalogue_reel_se_charge_sans_erreur(seeded):
    call_command("seed_catalog", verbosity=0)

    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    en_attente = [r for r in source if r["family"] == "techniques-yamaha"]
    attendu = len(source) - len(en_attente)

    assert CatalogLine.objects.filter(campaign=seeded).count() == attendu
    assert attendu == 255, "le fichier 2027 porte 257 lignes, dont 2 Yamaha differees"


def test_la_famille_sans_catalogue_ne_recoit_aucune_ligne(seeded):
    """Le mécanisme PENDING permet d'ouvrir la campagne sans le dernier catalogue."""
    call_command("seed_catalog", verbosity=0)

    yamaha = CatalogFamily.objects.get(key="techniques-yamaha")
    assert yamaha.status == CatalogFamily.Status.PENDING
    assert not yamaha.is_open
    assert CatalogLine.objects.filter(family=yamaha).count() == 0


def test_le_meme_code_survit_sur_plusieurs_marques(seeded):
    """La regression la plus coûteuse : dédoublonner sur `code` perdrait 30 lignes."""
    call_command("seed_catalog", verbosity=0)

    lignes_tp02 = CatalogLine.objects.filter(campaign=seeded, code="TP02")
    assert lignes_tp02.count() == 10
    marques = {l.brand.label for l in lignes_tp02.select_related("brand") if l.brand}
    assert len(marques) == 10


def test_les_lignes_transverses_nont_pas_de_marque(seeded):
    call_command("seed_catalog", verbosity=0)

    transverses = CatalogLine.objects.filter(campaign=seeded, brand__isnull=True)
    assert transverses.count() > 0
    assert not Brand.objects.filter(label__icontains="TOUTES").exists()


def test_les_familles_process_portent_aussi_des_marques(seeded):
    """Modéliser Process comme « sans marque » perdrait X24017V, FTIR01, TP02…"""
    call_command("seed_catalog", verbosity=0)

    process = CatalogLine.objects.filter(
        campaign=seeded, family__key__startswith="process-", brand__isnull=False
    )
    assert process.count() > 0


def test_le_catalogue_est_refuse_sur_une_campagne_ouverte(seeded):
    seeded.status = Campaign.Status.OPEN
    seeded.save(update_fields=["status"])

    with pytest.raises(CommandError) as exc:
        call_command("seed_catalog", verbosity=0)
    assert "brouillon" in str(exc.value)


def test_le_seed_est_rejouable(seeded):
    call_command("seed_catalog", verbosity=0)
    premier = CatalogLine.objects.filter(campaign=seeded).count()
    call_command("seed_referential", verbosity=0)
    call_command("seed_catalog", verbosity=0)
    assert CatalogLine.objects.filter(campaign=seeded).count() == premier
