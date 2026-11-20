"""Seed des modèles : créer seulement, jamais d'écrasement (AGENTS.md §7)."""

import pytest
from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext

from outbound.models import EmailTemplate

ECRITURES = ("INSERT", "UPDATE", "DELETE")


@pytest.mark.django_db
def test_rejeu_sans_ecriture():
    call_command("seed_email_templates", verbosity=0)
    total = EmailTemplate.objects.count()
    assert total > 0

    with CaptureQueriesContext(connection) as ctx:
        call_command("seed_email_templates", verbosity=0)
    ecritures = [q["sql"] for q in ctx.captured_queries if q["sql"].lstrip().upper().startswith(ECRITURES)]
    assert ecritures == []
    assert EmailTemplate.objects.count() == total


@pytest.mark.django_db
def test_modele_revu_ou_desactive_preserve():
    call_command("seed_email_templates", verbosity=0)
    modele = EmailTemplate.objects.order_by("pk").first()
    modele.subject = "Objet revu"
    modele.is_active = False
    modele.save()
    autre = EmailTemplate.objects.exclude(pk=modele.pk).order_by("pk").first()
    cle_supprimee = (autre.key, autre.locale)
    autre.delete()

    call_command("seed_email_templates", verbosity=0)

    modele.refresh_from_db()
    assert (modele.subject, modele.is_active) == ("Objet revu", False)
    assert EmailTemplate.objects.filter(key=modele.key, locale=modele.locale).count() == 1
    assert EmailTemplate.objects.filter(key=cle_supprimee[0], locale=cle_supprimee[1]).count() == 1
