"""Smoke du realm commun sur un vrai Keycloak (fédération L3).

À lancer explicitement, Keycloak démarré et realm appliqué par keycloak-config-cli :
    KC_URL=http://localhost:18080 pytest -q tests/smoke_realm.py
Variables : KC_ADMIN / KC_ADMIN_PASSWORD (admin/admin), SPA_ATTENDUE (enabled|disabled),
DEMO_ATTENDUE (presente|absente), EMETTEUR_ATTENDU (prod : KC_HOSTNAME + /realms/cfao),
CFAO_PORTAL_REDIRECT_URIS / CFAO_NEEDS_REDIRECT_URIS / CFAO_SPA_REDIRECT_URIS (listes JSON
passées au job config), PORTAIL_WEB_RAPPEL (rappel autorisé de cfao-portail-web).

Les jetons sont obtenus par les vrais flux (code + secret pour le BFF, PKCE pour
la SPA needs) et vérifiés par la lib commune `core/auth/jwt_verifier.py`.
"""
import base64
import hashlib
import html
import importlib.util
import json
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
# Constat 13 : le portail n'envoie son jeton qu'à core, planning et supervision.
API_PORTAIL = ("cfao-core-api", "cfao-planning-api", "cfao-supervision-api")
HORS_PORTAIL = ("cfao-needs-api", "cfao-cr-api", "cfao-operations-api")
TOUTES_API = {*API_PORTAIL, *HORS_PORTAIL}

if not KC_URL:
    pytest.fail("KC_URL est obligatoire (Keycloak démarré, realm appliqué).", pytrace=False)

_spec = importlib.util.spec_from_file_location(
    "jwt_verifier", RACINE / "cfao-core" / "core" / "auth" / "jwt_verifier.py")
jwt_verifier = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(jwt_verifier)
# Hostname fixé (recette, prod) : l'émetteur des jetons est l'URL publique, pas KC_URL.
EMETTEURS = {os.environ.get("EMETTEUR_ATTENDU") or REALM: f"{OIDC}/certs"}


def _formulaire(page, ident):
    """L'URL d'action du formulaire Keycloak `ident` de cette page."""
    formulaire = re.search(rf'<form[^>]*id="{ident}"[^>]*>', page.text)
    assert formulaire, f"pas de formulaire {ident} ({page.status_code})"
    return html.unescape(re.search(r'action="([^"]+)"', formulaire.group(0)).group(1))


def _connexion(client_id, redirect_uri, utilisateur=UTILISATEUR, mot_de_passe=MOT_DE_PASSE, **extra):
    """Page de login puis saisie : (session, réponse brute de Keycloak)."""
    s = requests.Session()
    page = s.get(f"{OIDC}/auth", params={"client_id": client_id, "redirect_uri": redirect_uri,
                                          "response_type": "code", "scope": "openid", **extra})
    page.raise_for_status()
    # Keycloak pose ses cookies en Secure ; un navigateur les renvoie sur
    # http://localhost (contexte sûr), requests non : on fait comme le navigateur.
    for cookie in s.cookies:
        cookie.secure = False
    action = _formulaire(page, "kc-form-login")
    return s, s.post(action, data={"username": utilisateur, "password": mot_de_passe}, allow_redirects=False)


def _code_de(r, redirect_uri):
    """Le code d'autorisation d'une redirection finale de Keycloak."""
    assert r.status_code == 302, r.text[:300]
    lieu = r.headers["Location"]
    assert lieu.startswith(redirect_uri), lieu
    return parse_qs(urlparse(lieu).query)["code"][0]


def _code(client_id, redirect_uri, **extra):
    """Flux d'autorisation complet du compte de test : code renvoyé."""
    return _code_de(_connexion(client_id, redirect_uri, **extra)[1], redirect_uri)


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


def _jeton_pkce(client_id, redirect):
    """Flux code + PKCE d'un client public : réponse du point /token."""
    verif = secrets.token_urlsafe(48)
    defi = base64.urlsafe_b64encode(hashlib.sha256(verif.encode()).digest()).rstrip(b"=").decode()
    code = _code(client_id, redirect, code_challenge=defi, code_challenge_method="S256")
    r = requests.post(f"{OIDC}/token", data={
        "grant_type": "authorization_code", "code": code, "redirect_uri": redirect,
        "client_id": client_id, "code_verifier": verif})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def jeton_needs():
    return _jeton_pkce("cfao-needs-web", "http://localhost:8082/cb")


@pytest.fixture(scope="module")
def jeton_portail_web():
    # Le portail réellement servi (prod : cfao-portail-web derrière edge).
    return _jeton_pkce("cfao-portail-web", os.environ.get(
        "PORTAIL_WEB_RAPPEL", "http://localhost:8088/callback"))


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


def test_portail_web_vise_les_api_du_portail(jeton_portail_web):
    claims = jwt_verifier.verify(jeton_portail_web["access_token"], EMETTEURS, API_PORTAIL)
    assert _aud(claims) & TOUTES_API == set(API_PORTAIL)


@pytest.mark.parametrize("api", API_PORTAIL)
def test_chaque_api_accepte_le_jeton_du_portail(jeton_portail, api):
    jwt_verifier.verify(jeton_portail["access_token"], EMETTEURS, (api,))


@pytest.mark.parametrize("api", HORS_PORTAIL)
def test_api_hors_portail_refusent_le_jeton_du_portail(jeton_portail, jeton_portail_web, api):
    for jeton in (jeton_portail, jeton_portail_web):
        with pytest.raises(jwt_verifier.TokenRejected):
            jwt_verifier.verify(jeton["access_token"], EMETTEURS, (api,))


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


SPA_ACTIVE = os.environ.get("SPA_ATTENDUE", "enabled") == "enabled"


def test_spa_de_dev_refuse_le_grant_password():
    # Constat 14 : plus de grant password, même en dev.
    r = requests.post(f"{OIDC}/token", data={"grant_type": "password", "client_id": "cfao-spa",
                                              "username": UTILISATEUR, "password": MOT_DE_PASSE})
    assert r.status_code in (400, 401), r.text


@pytest.mark.skipif(not SPA_ACTIVE, reason="cfao-spa désactivée (prod)")
def test_spa_de_dev_par_pkce():
    jeton = _jeton_pkce("cfao-spa", "http://localhost:5173/callback")
    claims = jwt_verifier.verify(jeton["access_token"], EMETTEURS, ("cfao-core-api",))
    assert _aud(claims) & TOUTES_API == set(API_PORTAIL)


@pytest.mark.skipif(not SPA_ACTIVE, reason="cfao-spa désactivée (prod)")
def test_spa_de_dev_refuse_un_hote_du_lan_non_liste():
    # Constat 14 : l'ancien « http://192.168.*:5173/* » acceptait tout le LAN.
    r = requests.get(f"{OIDC}/auth", params={"client_id": "cfao-spa", "response_type": "code",
                                             "scope": "openid", "redirect_uri": "http://192.168.50.1:5173/x"})
    assert r.status_code == 400 and "redirect_uri" in r.text


def test_spa_de_dev_desactivee_en_prod():
    if SPA_ACTIVE:
        pytest.skip("cfao-spa active (dev)")
    r = requests.get(f"{OIDC}/auth", params={"client_id": "cfao-spa", "response_type": "code",
                                             "scope": "openid", "redirect_uri": "http://localhost:5173/x"})
    assert r.status_code in (400, 401), r.status_code


def test_comptes_de_demo_selon_l_environnement(admin):
    # En prod, seul le compte du smoke existe : aucun compte « demo » importé.
    trouves = admin.get(f"{KC_URL}/admin/realms/cfao/users",
                        params={"username": "brahim.tahir", "exact": "true"}).json()
    assert len(trouves) == (0 if os.environ.get("DEMO_ATTENDUE") == "absente" else 1)


def test_role_training_coordinator_publie(admin):
    r = admin.get(f"{KC_URL}/admin/realms/cfao/roles/training_coordinator")
    assert r.status_code == 200, r.text


def test_secret_du_portail_injecte(admin):
    (client,) = admin.get(f"{KC_URL}/admin/realms/cfao/clients", params={"clientId": "cfao-portal"}).json()
    secret = admin.get(f"{KC_URL}/admin/realms/cfao/clients/{client['id']}/client-secret").json()["value"]
    assert secret == os.environ.get("CFAO_PORTAL_SECRET", "dev-portal-secret")
    assert not secret.startswith("$(")


@pytest.mark.parametrize("client_id, variable, defaut", [
    ("cfao-portal", "CFAO_PORTAL_REDIRECT_URIS", ["http://localhost:8000/oauth2/callback"]),
    ("cfao-needs-web", "CFAO_NEEDS_REDIRECT_URIS",
     ["http://localhost:8082/*", "http://localhost:5174/*", "http://127.0.0.1:8082/*",
      "http://localhost:8088/besoins/*"]),
    ("cfao-spa", "CFAO_SPA_REDIRECT_URIS",
     ["http://localhost:5173/*", "http://localhost:8000/*", "http://localhost:8088/*"]),
])
def test_redirections_issues_de_l_environnement(admin, client_id, variable, defaut):
    # La liste JSON devient une vraie liste (plusieurs hôtes pendant une transition).
    attendues = json.loads(os.environ[variable]) if variable in os.environ else defaut
    (client,) = admin.get(f"{KC_URL}/admin/realms/cfao/clients", params={"clientId": client_id}).json()
    assert sorted(client["redirectUris"]) == sorted(attendues)


def test_redirection_vers_un_hote_inconnu_refusee():
    r = requests.get(f"{OIDC}/auth", params={"client_id": "cfao-portal", "response_type": "code",
                                             "scope": "openid", "redirect_uri": "http://evil.example/cb"})
    assert r.status_code == 400 and "redirect_uri" in r.text


def test_emetteur_canonique_quel_que_soit_l_hote_recu():
    # Prod : l'émetteur vient de KC_HOSTNAME, jamais du Host de la requête.
    attendu = os.environ.get("EMETTEUR_ATTENDU")
    if not attendu:
        pytest.skip("EMETTEUR_ATTENDU absent (pile de dev, hostname dynamique)")
    hote = urlparse(KC_URL).netloc
    for host in (hote, "evil.example"):
        conf = requests.get(f"{REALM}/.well-known/openid-configuration", headers={"Host": host}).json()
        assert conf["issuer"] == attendu, host
        assert conf["authorization_endpoint"].startswith(attendu), host
