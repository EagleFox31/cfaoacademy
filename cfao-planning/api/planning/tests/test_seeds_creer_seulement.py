"""Seeds en creer-seulement (AGENTS.md section 7) : rejeu sans ecriture, prod preservee."""
import pytest
from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext

from planning.models import CostKeyYear
from referential.models import Brand, BrandAlias

ECRITURES = ("INSERT", "UPDATE", "DELETE")


def _seeds():
    call_command("seed_referential", verbosity=0)
    call_command("seed_cost_key", verbosity=0)


@pytest.mark.django_db
def test_rejeu_sans_ecriture():
    _seeds()
    with CaptureQueriesContext(connection) as ctx:
        _seeds()
    assert [q["sql"] for q in ctx.captured_queries if q["sql"].lstrip().upper().startswith(ECRITURES)] == []


@pytest.mark.django_db
def test_donnees_revues_preservees_et_absentes_recreees():
    _seeds()
    Brand.objects.filter(code="toyota").update(label="TOYOTA (revu)")
    CostKeyYear.objects.filter(year=2026, pole="MOTORS").update(budget=1)
    alias = BrandAlias.objects.order_by("pk").first()
    alias_norm = alias.alias_norm
    alias.delete()

    _seeds()

    assert Brand.objects.get(code="toyota").label == "TOYOTA (revu)"
    assert CostKeyYear.objects.get(year=2026, pole="MOTORS").budget == 1
    assert BrandAlias.objects.filter(alias_norm=alias_norm).count() == 1
