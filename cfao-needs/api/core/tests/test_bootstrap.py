"""Preuves de la règle AGENTS.md §7 pour needs : `bootstrap` crée, ne réécrit jamais.

- base vide : référentiel, catalogue et modèles d'emails complets, aucun compte ;
- base à jour : zéro INSERT / UPDATE / DELETE ;
- base existante modifiée en production : tout est préservé, seul le manquant revient.
"""
import pytest
from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext

from campaigns.models import Campaign, CatalogLine
from outbound.management.commands.seed_email_templates import LOCALES, TEMPLATES
from outbound.models import EmailTemplate
from referential.models import Brand, BrandAlias, CatalogFamily, UserProfile

pytestmark = pytest.mark.django_db


def ecritures(**options) -> list[str]:
    with CaptureQueriesContext(connection) as ctx:
        call_command("bootstrap", verbosity=0, **options)
    return [
        q["sql"] for q in ctx.captured_queries
        if q["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))
    ]


def test_base_vide_complete_sans_compte():
    call_command("bootstrap", verbosity=0)

    assert CatalogFamily.objects.count() == 8
    assert Brand.objects.count() == 21
    campagne = Campaign.objects.get(year=2027)
    assert campagne.status == Campaign.Status.DRAFT
    assert CatalogLine.objects.filter(campaign=campagne).count() == 255
    assert not CatalogLine.objects.filter(family__key="techniques-yamaha").exists()
    assert EmailTemplate.objects.count() == len(TEMPLATES) * len(LOCALES) == 28
    assert UserProfile.objects.count() == 0


def test_second_passage_zero_ecriture():
    call_command("bootstrap", verbosity=0)
    assert ecritures() == []


def test_demo_puis_zero_ecriture():
    call_command("bootstrap", demo=True, verbosity=0)
    assert UserProfile.objects.count() == 7
    assert ecritures(demo=True) == []


def test_open_charge_le_catalogue_avant_d_ouvrir():
    call_command("bootstrap", demo=True, open=True, verbosity=0)
    campagne = Campaign.objects.get(year=2027)
    assert campagne.status == Campaign.Status.OPEN
    assert CatalogLine.objects.filter(campaign=campagne).count() == 255


def test_base_existante_modifiee_en_production_est_preservee():
    call_command("bootstrap", demo=True, verbosity=0)
    campagne = Campaign.objects.get(year=2027)
    lignes = sorted(CatalogLine.objects.values_list("pk", flat=True))

    # Gestes de production : ouverture, catalogue livré, corrections à la main.
    Campaign.objects.filter(pk=campagne.pk).update(status=Campaign.Status.OPEN)
    CatalogFamily.objects.filter(key="techniques-yamaha").update(status=CatalogFamily.Status.READY)
    CatalogFamily.objects.filter(key="techniques-motors").update(label="Motors (corrigé)")
    Brand.objects.filter(code="fiat").update(label="FIAT PRO", is_active=False)
    EmailTemplate.objects.filter(key="internal.submission_summary", locale="fr").update(
        subject="Objet revu", is_active=False
    )
    UserProfile.objects.filter(email="chef.atelier@cfao.com").update(
        roles=["team_manager"], display_name="Titre revu"
    )
    chef = UserProfile.objects.get(email="chef.atelier@cfao.com")
    chef.brands.set([])
    BrandAlias.objects.filter(alias="SINOTRUCK").delete()

    call_command("bootstrap", demo=True, verbosity=0)

    assert Campaign.objects.get(pk=campagne.pk).status == Campaign.Status.OPEN
    assert sorted(CatalogLine.objects.values_list("pk", flat=True)) == lignes
    yamaha = CatalogFamily.objects.get(key="techniques-yamaha")
    assert yamaha.status == CatalogFamily.Status.READY
    assert not CatalogLine.objects.filter(family=yamaha).exists()
    assert CatalogFamily.objects.get(key="techniques-motors").label == "Motors (corrigé)"
    fiat = Brand.objects.get(code="fiat")
    assert (fiat.label, fiat.is_active) == ("FIAT PRO", False)
    modele = EmailTemplate.objects.get(key="internal.submission_summary", locale="fr")
    assert (modele.subject, modele.is_active) == ("Objet revu", False)
    chef.refresh_from_db()
    assert (chef.roles, chef.display_name) == (["team_manager"], "Titre revu")
    assert not chef.brands.exists()
    # Le manquant revient : l'alias supprimé est recréé.
    assert BrandAlias.objects.get(alias="SINOTRUCK").brand.code == "sinotruk"
