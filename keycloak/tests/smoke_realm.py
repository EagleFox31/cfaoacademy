"""Smoke du realm commun sur un vrai Keycloak (fédération L3).

À lancer explicitement, Keycloak démarré et realm appliqué par keycloak-config-cli :
    KC_URL=http://localhost:18080 pytest -q tests/smoke_realm.py
Variables : KC_ADMIN / KC_ADMIN_PASSWORD (admin/admin), SPA_ATTENDUE (enabled|disabled).

Les jetons sont obtenus par les vrais flux (code + secret pour le BFF, PKCE pour
la SPA needs) et vérifiés par la lib commune `core/auth/jwt_verifier.py`.
"""
import base64
import hashlib
import html
import importlib.util
import os
import re
import secrets
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
import requests

RACINE = Path(__file__).resolve().parents[2]
KC_URL = os.environ.get("KC_URL", "").rstrip("/")
REALM = f"{KC_URL}/realms/cfao"
OIDC = f"{REALM}/protocol/openid-connect"
UTILISATEUR, MOT_DE_PASSE = "kouame.assi", "demo"
API_PORTAIL = ("cfao-core-api", "cfao-cr-api", "cfao-planning-api", "cfao-operations-api")
TOUTES_API = {*API_PORTAIL, "cfao-needs-api"}

if not KC_URL:
    pytest.fail("KC_URL est obligatoire (Keycloak démarré, realm appliqué).", pytrace=False)

_spec = importlib.util.spec_from_file_location(
    "jwt_verifier", RACINE / "cfao-core" / "core" / "auth" / "jwt_verifier.py")
jwt_verifier = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(jwt_verifier)
EMETTEURS = {REALM: f"{OIDC}/certs"}


def _code(client_id, redirect_uri, **extra):
    """Flux d'autorisation complet : page de login, saisie, code renvoyé."""
    s = requests.Session()
    page = s.get(f"{OIDC}/auth", params={"client_id": client_id, "redirect_uri": redirect_uri,
                                          "response_type": "code", "scope": "openid", **extra})
    page.raise_for_status()
    # Keycloak pose ses cookies en Secure ; un navigateur les renvoie sur
    # http://localhost (contexte sûr), requests non : on fait comme le navigateur.
    for cookie in s.cookies:
        cookie.secure = False
    formulaire = re.search(r'<form[^>]*id="kc-form-login"[^>]*>', page.text)
    assert formulaire, f"pas de formulaire de login ({page.status_code})"
    action = html.unescape(re.search(r'action="([^"]+)"', formulaire.group(0)).group(1))
    r = s.post(action, data={"username": UTILISATEUR, "password": MOT_DE_PASSE}, allow_redirects=False)
    assert r.status_code == 302, r.text[:300]
    lieu = r.headers["Location"]
    assert lieu.startswith(redirect_uri), lieu
    return parse_qs(urlparse(lieu).query)["code"][0]


def _aud(claims):
    aud = claims.get("aud", [])
    return {aud} if isinstance(aud, str) else set(aud)


@pytest.fixture(scope="module")
def jeton_portail():
    redirect = "http://localhost:8000/oauth2/callback"
    code = _code("cfao-portal", redirect)
    r = requests.post(f"{OIDC}/token", data={
        "grant_type": "authorization_code", "code": code, "redirect_uri": redirect,
        "client_id": "cfao-portal", "client_secret": os.environ.get("CFAO_PORTAL_SECRET", "dev-portal-secret")})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def jeton_needs():
    redirect = "http://localhost:8082/cb"
    verif = secrets.token_urlsafe(48)
    defi = base64.urlsafe_b64encode(hashlib.sha256(verif.encode()).digest()).rstrip(b"=").decode()
    code = _code("cfao-needs-web", redirect, code_challenge=defi, code_challenge_method="S256")
    r = requests.post(f"{OIDC}/token", data={
        "grant_type": "authorization_code", "code": code, "redirect_uri": redirect,
        "client_id": "cfao-needs-web", "code_verifier": verif})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def admin():
    r = requests.post(f"{KC_URL}/realms/master/protocol/openid-connect/token", data={
        "grant_type": "password", "client_id": "admin-cli",
        "username": os.environ.get("KC_ADMIN", "admin"),
        "password": os.environ.get("KC_ADMIN_PASSWORD", "admin")})
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return s


def test_portail_vise_les_api_du_portail(jeton_portail):
    claims = jwt_verifier.verify(jeton_portail["access_token"], EMETTEURS, API_PORTAIL)
    assert _aud(claims) & TOUTES_API == set(API_PORTAIL)
    assert "learner" in claims["realm_access"]["roles"]
    assert claims["scopeNode"] == "groupe.afrique_ouest.cote_divoire.abidjan_plateau"


@pytest.mark.parametrize("api", API_PORTAIL)
def test_chaque_api_accepte_le_jeton_du_portail(jeton_portail, api):
    jwt_verifier.verify(jeton_portail["access_token"], EMETTEURS, (api,))


def test_api_needs_refuse_le_jeton_du_portail(jeton_portail):
    with pytest.raises(jwt_verifier.TokenRejected):
        jwt_verifier.verify(jeton_portail["access_token"], EMETTEURS, ("cfao-needs-api",))


def test_spa_needs_vise_needs_seulement(jeton_needs):
    claims = jwt_verifier.verify(jeton_needs["access_token"], EMETTEURS, ("cfao-needs-api",))
    assert _aud(claims) & TOUTES_API == {"cfao-needs-api"}
    with pytest.raises(jwt_verifier.TokenRejected):
        jwt_verifier.verify(jeton_needs["access_token"], EMETTEURS, ("cfao-core-api",))


def test_session_bornee_a_huit_heures(jeton_portail):
    # Le refresh token suit l'inactivité (30 min), la session reste bornée à 8 h.
    assert 0 < jeton_portail["refresh_expires_in"] <= 30 * 60
    assert jeton_portail["expires_in"] <= 900


def test_api_bearer_only_ne_delivre_aucun_jeton():
    r = requests.post(f"{OIDC}/token", data={"grant_type": "client_credentials", "client_id": "cfao-core-api"})
    assert r.status_code in (400, 401), r.text


def test_spa_needs_refuse_le_grant_password():
    r = requests.post(f"{OIDC}/token", data={"grant_type": "password", "client_id": "cfao-needs-web",
                                              "username": UTILISATEUR, "password": MOT_DE_PASSE})
    assert r.status_code in (400, 401), r.text


def test_spa_de_dev_selon_l_environnement():
    r = requests.post(f"{OIDC}/token", data={"grant_type": "password", "client_id": "cfao-spa",
                                              "username": UTILISATEUR, "password": MOT_DE_PASSE})
    if os.environ.get("SPA_ATTENDUE", "enabled") == "enabled":
        assert r.status_code == 200, r.text
        claims = jwt_verifier.verify(r.json()["access_token"], EMETTEURS, ("cfao-core-api",))
        assert "cfao-cr-api" in _aud(claims)
    else:
        assert r.status_code in (400, 401), r.text


def test_role_training_coordinator_publie(admin):
    r = admin.get(f"{KC_URL}/admin/realms/cfao/roles/training_coordinator")
    assert r.status_code == 200, r.text


def test_secret_du_portail_injecte(admin):
    (client,) = admin.get(f"{KC_URL}/admin/realms/cfao/clients", params={"clientId": "cfao-portal"}).json()
    secret = admin.get(f"{KC_URL}/admin/realms/cfao/clients/{client['id']}/client-secret").json()["value"]
    assert secret == os.environ.get("CFAO_PORTAL_SECRET", "dev-portal-secret")
    assert not secret.startswith("$(")
