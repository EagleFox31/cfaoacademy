"""Recette de cfao-edge devant le vrai needs (images de prod), avant bascule zrok.

needs est sur le Keycloak commun (L6) : la connexion passe par l'émetteur public
(/auth, seul servi par l'écoute publique), y compris depuis l'écoute LAN.
Variables : EDGE_URL (passerelle, écoute publique), NEEDS_URL (needs en direct),
EDGE_LAN_NEEDS_URL (écoute LAN, optionnelle), NEEDS_UTILISATEUR, NEEDS_MOT_DE_PASSE,
EMETTEUR_ATTENDU (KC_HOSTNAME + /realms/cfao, défaut : EDGE_URL/auth/realms/cfao).
"""
import base64
import hashlib
import json
import os
import re
import secrets
from html import unescape
from urllib.parse import parse_qs, urlparse

import pytest
import requests

EDGE_URL = os.environ["EDGE_URL"].rstrip("/")
NEEDS_URL = os.environ["NEEDS_URL"].rstrip("/")
LAN_URL = os.environ.get("EDGE_LAN_NEEDS_URL", "").rstrip("/")
EMETTEUR = os.environ.get("EMETTEUR_ATTENDU", f"{EDGE_URL}/auth/realms/cfao").rstrip("/")
OIDC = f"{EMETTEUR}/protocol/openid-connect"
CLIENT = "cfao-needs-web"
API = "/api/v1/needs/campaigns"
ENTREES = [EDGE_URL] + ([LAN_URL] if LAN_URL else [])


def _charge(jeton):
    partie = jeton.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(partie + "=" * (-len(partie) % 4)))


@pytest.mark.parametrize("entree", ENTREES)
@pytest.mark.parametrize("chemin", ["/", "/campagnes", "/config.js", "/api/v1/needs/healthz"])
def test_meme_reponse_qu_en_direct(entree, chemin):
    hote = {"Host": urlparse(EDGE_URL).netloc}
    direct = requests.get(f"{NEEDS_URL}{chemin}", headers=hote)
    vu = requests.get(f"{entree}{chemin}", headers=hote)
    assert (vu.status_code, vu.content) == (direct.status_code, direct.content)
    for en_tete in ("Content-Type", "X-Frame-Options", "X-Content-Type-Options"):
        assert vu.headers.get(en_tete) == direct.headers.get(en_tete), en_tete


@pytest.mark.parametrize("entree", ENTREES)
def test_spa_configure_sur_l_emetteur_commun(entree):
    r = requests.get(f"{entree}/config.js")
    assert r.status_code == 200 and "javascript" in r.headers["Content-Type"]
    assert f'"oidcIssuer": "{EMETTEUR}"' in r.text and f'"oidcClientId": "{CLIENT}"' in r.text
    assert "no-cache" in r.headers.get("Cache-Control", "")


def test_ancien_realm_de_needs_plus_servi():
    r = requests.get(f"{EDGE_URL}/realms/cfao-needs/.well-known/openid-configuration")
    assert "json" not in r.headers.get("Content-Type", "")


def test_api_refuse_sans_jeton():
    # needs répond 403 (DRF sans en-tête WWW-Authenticate).
    assert requests.get(f"{EDGE_URL}{API}").status_code in (401, 403)


@pytest.mark.parametrize("entree", ENTREES)
def test_connexion_pkce_et_api(entree):
    rappel = f"{entree}/callback"
    verif = secrets.token_urlsafe(48)
    defi = base64.urlsafe_b64encode(hashlib.sha256(verif.encode()).digest()).rstrip(b"=").decode()
    s = requests.Session()
    page = s.get(f"{OIDC}/auth", params={
        "client_id": CLIENT, "redirect_uri": rappel, "response_type": "code", "scope": "openid",
        "code_challenge": defi, "code_challenge_method": "S256"})
    assert page.status_code == 200, page.text[:300]
    # Cookies Secure : un navigateur les renvoie sur http://localhost, requests non.
    for cookie in s.cookies:
        cookie.secure = False
    action = unescape(re.search(r'action="([^"]+)"', page.text).group(1))
    assert action.startswith(f"{EMETTEUR}/"), action
    r = s.post(action, data={"username": os.environ["NEEDS_UTILISATEUR"],
                             "password": os.environ["NEEDS_MOT_DE_PASSE"]}, allow_redirects=False)
    assert r.status_code == 302 and r.headers["Location"].startswith(f"{rappel}?"), r.text[:300]
    code = parse_qs(urlparse(r.headers["Location"]).query)["code"][0]
    # Le SPA échange le code depuis son origine : sur le LAN, en cross-origin.
    jeton = requests.post(f"{OIDC}/token", headers={"Origin": entree}, data={
        "grant_type": "authorization_code", "code": code, "redirect_uri": rappel,
        "client_id": CLIENT, "code_verifier": verif})
    assert jeton.status_code == 200, jeton.text
    assert jeton.headers.get("Access-Control-Allow-Origin") == entree
    acces = jeton.json()["access_token"]
    charge = _charge(acces)
    assert charge["iss"] == EMETTEUR
    aud = charge["aud"] if isinstance(charge["aud"], list) else [charge["aud"]]
    assert "cfao-needs-api" in aud
    api = requests.get(f"{entree}{API}", headers={"Authorization": f"Bearer {acces}"})
    assert api.status_code == 200, api.text[:300]


@pytest.mark.parametrize("rappel", [f"{EDGE_URL}/autre", f"{EDGE_URL}/callback/x", "http://evil.example/callback"])
def test_redirection_hors_liste_refusee(rappel):
    r = requests.get(f"{OIDC}/auth", params={"client_id": CLIENT, "redirect_uri": rappel,
                                             "response_type": "code", "scope": "openid"})
    assert r.status_code == 400 and "redirect_uri" in r.text.lower().replace(" ", "_")
