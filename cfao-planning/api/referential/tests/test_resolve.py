"""Reconnaissance des formateurs à l'import."""
import pytest

from referential.models import Trainer
from referential.normalize import norm_key
from referential.resolve import Resolver

pytestmark = pytest.mark.django_db


def _trainer(name, **extra):
    return Trainer.objects.create(full_name=name, name_norm=norm_key(name), **extra)


def test_un_formateur_inactif_reste_reconnu():
    parti = _trainer("Personne Partie", is_active=False)
    assert Resolver().trainer("PERSONNE PARTIE").obj == parti


def test_un_nom_inconnu_reste_rejete():
    _trainer("Personne Connue")
    assert Resolver().trainer("Personne Absente") is None
