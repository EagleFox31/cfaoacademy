"""Recette de cfao-edge devant le vrai needs (images de prod), avant bascule zrok.

Prouve que la passerelle est transparente pour needs, y compris la connexion par
son propre Keycloak (/realms/cfao-needs) tant que L6 n'est pas fait.
Variables : EDGE_URL (passerelle, écoute publique), NEEDS_URL (needs en direct),
EDGE_LAN_NEEDS_URL (écoute LAN, optionnelle), NEEDS_UTILISATEUR, NEEDS_MOT_DE_PASSE,
NEEDS_REALM (cfao-needs), NEEDS_CLIENT (needs-web).
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
REALM = os.environ.get("NEEDS_REALM", "cfao-needs")
CLIENT = os.environ.get("NEEDS_CLIENT", "needs-web")
API = "/api/v1/needs/campaigns"
ENTREES = [EDGE_URL] + ([LAN_URL] if LAN_URL else [])


@pytest.mark.parametrize("entree", ENTREES)
@pytest.mark.parametrize("chemin", ["/", "/campagnes", "/api/v1/needs/healthz"])
def test_meme_reponse_qu_en_direct(entree, chemin):
    hote = {"Host": urlparse(EDGE_URL).netloc}
    direct = requests.get(f"{NEEDS_URL}{chemin}", headers=hote)
    vu = requests.get(f"{entree}{chemin}", headers=hote)
    assert (vu.status_code, vu.content) == (direct.status_code, direct.content)
    for en_tete in ("Content-Type", "X-Frame-Options", "X-Content-Type-Options"):
        assert vu.headers.get(en_tete) == direct.headers.get(en_tete), en_tete


def test_api_refuse_sans_jeton():
    # needs répond 403 (DRF sans en-tête WWW-Authenticate).
    assert requests.get(f"{EDGE_URL}{API}").status_code in (401, 403)


def test_connexion_pkce_et_api_par_la_passerelle():
    oidc = f"{EDGE_URL}/realms/{REALM}/protocol/openid-connect"
    rappel = f"{EDGE_URL}/callback"
    verif = secrets.token_urlsafe(48)
    defi = base64.urlsafe_b64encode(hashlib.sha256(verif.encode()).digest()).rstrip(b"=").decode()
    s = requests.Session()
    page = s.get(f"{oidc}/auth", params={
        "client_id": CLIENT, "redirect_uri": rappel, "response_type": "code", "scope": "openid",
        "code_challenge": defi, "code_challenge_method": "S256"})
    assert page.status_code == 200, page.text[:300]
    action = unescape(re.search(r'action="([^"]+)"', page.text).group(1))
    assert action.startswith(f"{EDGE_URL}/realms/{REALM}/"), action
    r = s.post(action, data={"username": os.environ["NEEDS_UTILISATEUR"],
                             "password": os.environ["NEEDS_MOT_DE_PASSE"]}, allow_redirects=False)
    assert r.status_code == 302 and r.headers["Location"].startswith(rappel), r.text[:300]
    code = parse_qs(urlparse(r.headers["Location"]).query)["code"][0]
    jeton = requests.post(f"{oidc}/token", data={
        "grant_type": "authorization_code", "code": code, "redirect_uri": rappel,
        "client_id": CLIENT, "code_verifier": verif})
    assert jeton.status_code == 200, jeton.text
    acces = jeton.json()["access_token"]
    charge = acces.split(".")[1]
    iss = json.loads(base64.urlsafe_b64decode(charge + "=" * (-len(charge) % 4)))["iss"]
    assert iss == f"{EDGE_URL}/realms/{REALM}"
    api = requests.get(f"{EDGE_URL}{API}", headers={"Authorization": f"Bearer {acces}"})
    assert api.status_code == 200, api.text[:300]
