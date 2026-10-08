"""Chaque test travaille dans des dossiers temporaires et sans PDP reel.

Le PDP Cerbos est remplace par la fixture `pdp` : elle autorise par
defaut et note chaque demande (kind, action, attributs), pour verifier
que chaque route passe bien par le PEP. Les regles elles-memes sont
testees par `cerbos compile --tests` (voir `cerbos/tests/`).
"""
import pytest
from rest_framework.test import APIClient

import photos
from comptes_rendus import taches, views
from core.authz import cerbos


@pytest.fixture(autouse=True)
def dossiers_temporaires(tmp_path, monkeypatch):
    """Photos et caches dans `tmp_path`, jamais dans des donnees reelles."""
    monkeypatch.setattr(photos, "PERMANENT", tmp_path / "photos")
    monkeypatch.setattr(views, "CACHE", tmp_path / "cache")


@pytest.fixture(autouse=True)
def taches_synchrones(monkeypatch):
    """La production « en fond » s'execute tout de suite, dans le fil du test."""
    monkeypatch.setattr(taches, "lancer_en_fond", lambda fonction, *args: fonction(*args))


class FauxPDP:
    def __init__(self):
        self.demandes = []
        self.reponse = True

    def __call__(self, principal, resource, action):
        self.demandes.append({"principal": principal, "kind": resource["kind"],
                              "id": resource.get("id"), "action": action,
                              "attr": resource.get("attr", {})})
        return self.reponse(principal, resource, action) if callable(self.reponse) else self.reponse


@pytest.fixture(autouse=True)
def pdp(monkeypatch):
    faux = FauxPDP()
    monkeypatch.setattr(cerbos, "check_permission", faux)
    return faux


@pytest.fixture
def client(db):
    """Un client identifie par l'en-tete `X-User-ID` (mode autonome)."""
    def ouvrir(user_id="f-demo"):
        c = APIClient()
        c.credentials(HTTP_X_USER_ID=user_id)
        return c
    return ouvrir


@pytest.fixture
def anonyme(db):
    return APIClient()
