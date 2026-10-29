"""Smoke de cfao-edge : la vraie passerelle devant un vrai Keycloak (servi sous
/auth) et deux modules factices (needs, cr).

Variables : EDGE_URL (passerelle complète, proto http), EDGE_HTTPS_URL (instance
en proto https sans Keycloak ni CR), KC_INTERNE (Keycloak en direct, avec /auth),
EMETTEUR_ATTENDU, EDGE_CONTENEUR_HTTPS (nom du conteneur de l'instance https,
pour les journaux).
"""
import base64
import hashlib
import os
import secrets
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

import pytest
import requests

EDGE_URL = os.environ["EDGE_URL"].rstrip("/")
EDGE_HTTPS_URL = os.environ["EDGE_HTTPS_URL"].rstrip("/")
KC_INTERNE = os.environ["KC_INTERNE"].rstrip("/")
EMETTEUR = os.environ["EMETTEUR_ATTENDU"]

# Les helpers du smoke du realm lisent KC_URL à l'import : on le pose avant.
os.environ["KC_URL"] = f"{EDGE_URL}/auth"
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "keycloak" / "tests"))
from smoke_realm import _code_de, _connexion, jwt_verifier  # noqa: E402

REDIRECT_NEEDS = f"{EDGE_URL}/cb"
HOTE_PUBLIC = urlparse(EDGE_URL).netloc


def _vu(reponse):
    """Ce que le module factice a reçu."""
    return reponse.json()


def test_slash_est_relaye_a_needs_sans_rien_ajouter():
    r = requests.get(f"{EDGE_URL}/", headers={"X-Forwarded-Proto": "https",
                                              "X-Forwarded-Host": "zrok.exemple", "X-Forwarded-Port": "443"})
    vu = _vu(r)
    assert vu["module"] == "needs"
    assert vu["en_tetes"]["host"] == HOTE_PUBLIC
    assert vu["en_tetes"]["x-forwarded-proto"] == "https"
    assert vu["en_tetes"]["x-forwarded-host"] == "zrok.exemple"
    assert vu["en_tetes"]["x-forwarded-port"] == "443"


def test_sans_x_forwarded_la_passerelle_n_en_invente_pas():
    en_tetes = _vu(requests.get(f"{EDGE_URL}/"))["en_tetes"]
    assert not [h for h in en_tetes if h.startswith("x-forwarded-proto")]


@pytest.mark.parametrize("chemin", ["/realms/cfao-needs/x", "/resources/x", "/auth-autre"])
def test_chemins_de_l_ancien_keycloak_de_needs_restent_chez_needs(chemin):
    assert _vu(requests.get(f"{EDGE_URL}{chemin}"))["module"] == "needs"


@pytest.mark.parametrize("chemin", ["/auth", "/auth/", "/auth/admin/", "/auth/admin/realms/cfao/users",
                                    "/auth/metrics", "/auth/health/ready", "/auth/js/keycloak.js"])
def test_surface_auth_reduite(chemin):
    assert requests.get(f"{EDGE_URL}{chemin}").status_code == 404


def test_emetteur_canonique_quel_que_soit_l_hote_recu():
    conf = requests.get(f"{EDGE_URL}/auth/realms/cfao/.well-known/openid-configuration",
                        headers={"Host": "evil.example"}).json()
    assert conf["issuer"] == EMETTEUR
    # Le préfixe /auth est conservé dans toutes les URL annoncées.
    assert conf["token_endpoint"].startswith(f"{EDGE_URL}/auth/")


def test_backchannel_interne_garde_l_emetteur_public():
    conf = requests.get(f"{KC_INTERNE}/realms/cfao/.well-known/openid-configuration").json()
    assert conf["issuer"] == EMETTEUR
    assert conf["token_endpoint"].startswith(KC_INTERNE)


def test_flux_pkce_complet_par_la_passerelle():
    verif = secrets.token_urlsafe(48)
    defi = base64.urlsafe_b64encode(hashlib.sha256(verif.encode()).digest()).rstrip(b"=").decode()
    session, r = _connexion("cfao-needs-web", REDIRECT_NEEDS,
                            code_challenge=defi, code_challenge_method="S256")
    assert session.cookies
    for cookie in session.cookies:
        assert cookie.path.startswith("/auth/realms/cfao"), (cookie.name, cookie.path)
    code = _code_de(r, REDIRECT_NEEDS)
    jeton = requests.post(f"{EDGE_URL}/auth/realms/cfao/protocol/openid-connect/token", data={
        "grant_type": "authorization_code", "code": code, "redirect_uri": REDIRECT_NEEDS,
        "client_id": "cfao-needs-web", "code_verifier": verif})
    assert jeton.status_code == 200, jeton.text
    claims = jwt_verifier.verify(
        jeton.json()["access_token"],
        {EMETTEUR: f"{KC_INTERNE}/realms/cfao/protocol/openid-connect/certs"}, ("cfao-needs-api",))
    assert claims["iss"] == EMETTEUR


def test_portail_a_liste_vide_refuse_toute_redirection():
    r = requests.get(f"{EDGE_URL}/auth/realms/cfao/protocol/openid-connect/auth", params={
        "client_id": "cfao-portal", "response_type": "code", "scope": "openid",
        "redirect_uri": "http://localhost:8000/oauth2/callback"})
    assert r.status_code == 400


def test_cr_redirige_sans_slash_en_relatif():
    r = requests.get(f"{EDGE_URL}/cr", allow_redirects=False)
    assert r.status_code == 308 and r.headers["Location"] == "/cr/"


def test_cr_garde_son_prefixe_et_confine_ses_cookies():
    r = requests.get(f"{EDGE_URL}/cr/cr-donnees/x")
    vu = _vu(r)
    assert vu["module"] == "cr" and vu["chemin"] == "/cr/cr-donnees/x"
    assert vu["en_tetes"]["x-forwarded-prefix"] == "/cr"
    cookies = r.raw.headers.getlist("Set-Cookie")
    assert "t1=1; Path=/cr/" in cookies
    assert "t2=1; Path=/cr/x" in cookies


def test_en_tetes_de_la_passerelle():
    r = requests.get(f"{EDGE_URL}/")
    assert r.headers["X-Frame-Options"] == "SAMEORIGIN"  # celui du module, jamais doublé
    assert "X-Powered-By" not in r.headers
    assert r.headers["Server"] == "nginx"
    assert "Strict-Transport-Security" not in r.headers  # URL publique en http
    hsts = requests.get(f"{EDGE_HTTPS_URL}/").headers["Strict-Transport-Security"]
    assert hsts == "max-age=31536000"


def test_limites_de_taille():
    assert requests.post(f"{EDGE_URL}/", data=b"x" * (13 * 1024 * 1024)).status_code == 413
    assert requests.post(f"{EDGE_URL}/cr/x", data=b"x" * (13 * 1024 * 1024)).status_code == 200
    assert requests.post(f"{EDGE_URL}/auth/realms/cfao/x", data=b"x" * (2 * 1024 * 1024)).status_code == 413


def test_modules_inactifs_retombent_sur_needs():
    for chemin in ("/cr/x", "/auth/realms/x"):
        assert _vu(requests.get(f"{EDGE_HTTPS_URL}{chemin}"))["module"] == "needs"


def test_journaux_json_sans_query_string():
    requests.get(f"{EDGE_HTTPS_URL}/?code=SECRET-123")
    conteneur = os.environ.get("EDGE_CONTENEUR_HTTPS", "edge-https")
    sortie = subprocess.run(["docker", "logs", conteneur], capture_output=True, text=True).stdout
    assert "SECRET-123" not in sortie
    lignes = [ligne for ligne in sortie.splitlines() if ligne.startswith("{")]
    assert lignes and all(k in lignes[-1] for k in ('"module"', '"status"', '"path"', '"req_id"'))
