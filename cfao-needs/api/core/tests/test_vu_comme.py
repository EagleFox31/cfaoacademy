"""Aperçu « vu comme » : lecture seule, décidé par core, jamais de repli sur l'identité réelle."""
import pytest
import requests
from django.core.cache import cache
from rest_framework import exceptions
from rest_framework.test import APIRequestFactory

from core.auth import identity, jwt_verifier
from core.auth.oidc import KeycloakJWTAuthentication

CIBLE = "compte-cible-1"


class Reponse:
    def __init__(self, statut, corps=None):
        self.status_code = statut
        self._corps = corps

    def json(self):
        if self._corps is None:
            raise ValueError
        return self._corps

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(self.status_code)


@pytest.fixture
def plateforme(settings, monkeypatch):
    settings.OIDC_AUDIENCE = "cfao-needs-api"
    settings.DEPLOYMENT_MODE = "integrated"
    settings.PLATFORM_CORE_HTTP = "http://core"
    cache.clear()
    monkeypatch.setattr(jwt_verifier, "verify", lambda *a, **k: {
        "sub": "sub-reel", "realm_access": {"roles": ["superadmin"]}})
    appels = []

    def faux_get(url, headers=None, timeout=None):
        appels.append(headers)
        return plateforme.reponse

    monkeypatch.setattr(identity.requests, "get", faux_get)
    plateforme.appels = appels
    plateforme.reponse = Reponse(200, {"id": "sub-reel", "roles": ["superadmin"], "attr": {}})
    yield plateforme
    cache.clear()


def _auth(methode="get", vu_comme=CIBLE):
    en_tetes = {"HTTP_AUTHORIZATION": "Bearer jeton"}
    if vu_comme is not None:
        en_tetes["HTTP_X_CFAO_VU_COMME"] = vu_comme
    requete = getattr(APIRequestFactory(), methode)("/api/v1/needs/brands", **en_tetes)
    return KeycloakJWTAuthentication().authenticate(requete)


@pytest.mark.parametrize("methode", ["post", "put", "patch", "delete"])
def test_ecriture_avec_en_tete_refusee_avant_toute_resolution(plateforme, methode):
    with pytest.raises(exceptions.PermissionDenied):
        _auth(methode)
    assert plateforme.appels == []


def test_lecture_vu_comme_prend_l_identite_de_la_cible(plateforme):
    plateforme.reponse = Reponse(200, {"id": "sub-cible", "roles": ["training_coordinator"],
                                       "attr": {"scopeNodes": ["groupe.x"], "apercu": True}})
    principal, _ = _auth()
    assert principal.id == "sub-cible"
    assert principal.roles == ["training_coordinator"]
    assert principal.attr["apercu"] is True and principal.attr["vu_par"] == "sub-reel"
    assert plateforme.appels[0][identity.EN_TETE_VU_COMME] == CIBLE


@pytest.mark.parametrize("statut, attendu", [
    (403, exceptions.PermissionDenied), (401, exceptions.PermissionDenied),
    (404, exceptions.NotFound), (500, exceptions.PermissionDenied)])
def test_refus_de_core_jamais_de_repli_sur_l_identite_reelle(plateforme, statut, attendu):
    plateforme.reponse = Reponse(statut, {"detail": "x"})
    with pytest.raises(attendu):
        _auth()


def test_core_sans_apercu_applique_est_refuse(plateforme):
    # core ancien (en-tête ignoré) : il renverrait le super admin lui-même.
    plateforme.reponse = Reponse(200, {"id": "sub-reel", "roles": ["superadmin"], "attr": {}})
    with pytest.raises(exceptions.PermissionDenied):
        _auth()


def test_core_injoignable_sous_aperçu_ne_retombe_pas_sur_le_reel(plateforme, monkeypatch):
    def panne(*a, **k):
        raise requests.ConnectionError

    monkeypatch.setattr(identity.requests, "get", panne)
    with pytest.raises(exceptions.APIException) as exc:
        _auth()
    assert exc.value.status_code == 500


def test_cache_separe_entre_aperçu_et_requete_normale(plateforme):
    plateforme.reponse = Reponse(200, {"id": "sub-cible", "roles": ["trainer"],
                                       "attr": {"apercu": True}})
    _auth()
    plateforme.reponse = Reponse(200, {"id": "sub-reel", "roles": ["superadmin"], "attr": {}})
    principal, _ = _auth(vu_comme=None)
    assert principal.roles == ["superadmin"] and "apercu" not in principal.attr
    assert identity.EN_TETE_VU_COMME not in plateforme.appels[-1]


def test_mode_autonome_refuse_l_aperçu(plateforme, settings):
    settings.DEPLOYMENT_MODE = "standalone"
    with pytest.raises(exceptions.PermissionDenied):
        _auth()
