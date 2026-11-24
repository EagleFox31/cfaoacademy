import pytest
from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext

from core.seeding import ensure
from sample.models import SampleItem

ECRITURES = ("INSERT", "UPDATE", "DELETE")


def _ecritures(ctx):
    return [q["sql"] for q in ctx.captured_queries if q["sql"].lstrip().upper().startswith(ECRITURES)]


@pytest.mark.django_db
def test_ensure_cree_une_seule_fois_et_ne_reecrit_pas():
    item, cree = ensure(SampleItem, {"title": "Ref"}, {"brand": "TOYOTA", "scope_node": "CMR"})
    assert cree
    SampleItem.objects.filter(pk=item.pk).update(brand="REVU EN PROD")

    with CaptureQueriesContext(connection) as ctx:
        _, cree = ensure(SampleItem, {"title": "Ref"}, {"brand": "TOYOTA", "scope_node": "CMR"})
    assert not cree
    assert _ecritures(ctx) == []
    assert SampleItem.objects.get(pk=item.pk).brand == "REVU EN PROD"


@pytest.mark.django_db
def test_bootstrap_rejouable_sans_ecriture():
    call_command("bootstrap", verbosity=0)
    with CaptureQueriesContext(connection) as ctx:
        call_command("bootstrap", verbosity=0)
    assert _ecritures(ctx) == []
