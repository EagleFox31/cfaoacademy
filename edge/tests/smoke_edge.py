"""Smoke de cfao-edge : la vraie passerelle devant un vrai Keycloak (servi sous
/auth) et deux modules factices (needs, cr).

Variables : EDGE_URL (passerelle complète, proto http), EDGE_HTTPS_URL (instance
en proto https sans Keycloak ni CR), KC_INTERNE (Keycloak en direct, avec /auth),
EMETTEUR_ATTENDU, EDGE_CONTENEUR_HTTPS (nom du conteneur de l'instance https,
pour les journaux), EDGE_LAN_NEEDS_URL et EDGE_LAN_CR_URL (écoutes LAN de la
passerelle complète), EDGE_IMAGE (refus au démarrage), EDGE_ATTENTE_URL
(instance dont les modules sont arrêtés : page d'attente).
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
LAN_NEEDS = os.environ["EDGE_LAN_NEEDS_URL"].rstrip("/")
LAN_CR = os.environ["EDGE_LAN_CR_URL"].rstrip("/")
IMAGE = os.environ.get("EDGE_IMAGE", "antifragile237/cfao-edge:smoke")
# Instance dont needs et planning ne répondent pas (aucun service sur le port).
ATTENTE = os.environ["EDGE_ATTENTE_URL"].rstrip("/")

# Les helpers du smoke du realm lisent KC_URL à l'import : on le pose avant.
os.environ["KC_URL"] = f"{EDGE_URL}/auth"
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "keycloak" / "tests"))
from smoke_realm import _code_de, _connexion, jwt_verifier  # noqa: E402

REDIRECT_NEEDS = f"{EDGE_URL}/callback"
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
                                    "/auth/metrics", "/auth/health/ready", "/auth/js/keycloak.js",
                                    "/auth/realms/master/.well-known/openid-configuration",
                                    "/auth/realms/master/protocol/openid-connect/token",
                                    "/auth/realms/cfao-autre/.well-known/openid-configuration"])
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
    assert vu["en_tetes"]["x-forwarded-host"] == urlparse(EDGE_URL).hostname
    cookies = r.raw.headers.getlist("Set-Cookie")
    assert "t1=1; Path=/cr/" in cookies
    assert "t2=1; Path=/cr/x" in cookies


@pytest.mark.parametrize("chemin", ["/", "/x", "/cr/x", "/auth/realms/cfao/.well-known/openid-configuration"])
def test_lan_needs_ne_sert_que_needs(chemin):
    r = requests.get(f"{LAN_NEEDS}{chemin}")
    assert _vu(r)["module"] == "needs" and _vu(r)["en_tetes"]["host"] == urlparse(LAN_NEEDS).netloc
    assert "Strict-Transport-Security" not in r.headers


def test_lan_cr_annonce_l_url_de_la_requete():
    r = requests.get(f"{LAN_CR}/cr/x")
    vu = _vu(r)
    assert vu["module"] == "cr" and vu["chemin"] == "/cr/x"
    attendu = urlparse(LAN_CR)
    assert vu["en_tetes"]["x-forwarded-proto"] == "http"
    assert vu["en_tetes"]["x-forwarded-host"] == attendu.hostname
    assert vu["en_tetes"]["x-forwarded-port"] == str(attendu.port)
    assert "Strict-Transport-Security" not in r.headers


@pytest.mark.parametrize("chemin, cible", [("/", "/cr/"), ("/rapport/12?v=1", "/cr/rapport/12?v=1"),
                                           ("/cr", "/cr/"), ("/auth/realms/cfao/x", "/cr/auth/realms/cfao/x")])
def test_lan_cr_redirige_les_anciens_liens_sous_cr(chemin, cible):
    r = requests.get(f"{LAN_CR}{chemin}", allow_redirects=False)
    assert r.status_code == 308 and r.headers["Location"] == cible


@pytest.mark.parametrize("lan, motif", [
    ("needs@127.0.0.1", "module@adresse:port"),
    ("inconnu@127.0.0.1:1", "sans écoute LAN"),
    ("cr@127.0.0.1:1", "EDGE_CR_UPSTREAM vide"),
    ("needs@127.0.0.1:1,needs@127.0.0.1:1", "déjà écouté"),
    ("needs@127.0.0.1:2", "déjà écouté"),
])
def test_ecoute_lan_invalide_bloque_le_demarrage(lan, motif):
    r = subprocess.run(["docker", "run", "--rm", "--network", "none",
                        "-e", "EDGE_LISTEN=127.0.0.1:2", "-e", "EDGE_PUBLIC_PROTO=https",
                        "-e", "EDGE_PUBLIC_HOST=localhost", "-e", "EDGE_PUBLIC_PORT=443",
                        "-e", "EDGE_NEEDS_UPSTREAM=127.0.0.1:3", "-e", f"EDGE_LAN={lan}", IMAGE, "nginx", "-t"],
                       capture_output=True, encoding="utf-8", timeout=60)
    assert r.returncode != 0 and motif in r.stderr, r.stderr[-500:]


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


NAVIGATEUR = {"Accept": "text/html,application/xhtml+xml,*/*;q=0.8"}


def _attente(r, type_):
    assert r.status_code == 503, r.text[:200]
    assert r.headers["Retry-After"] == "15" and r.headers["Cache-Control"] == "no-store"
    assert r.headers["Content-Type"].startswith(type_)


@pytest.mark.parametrize("chemin", ["/", "/portail/cle-repartition"])
def test_module_arrete_page_d_attente_pour_le_navigateur(chemin):
    r = requests.get(f"{ATTENTE}{chemin}", headers=NAVIGATEUR)
    _attente(r, "text/html")
    assert "Mise à jour en cours" in r.text and 'http-equiv="refresh"' in r.text


@pytest.mark.parametrize("methode, chemin, en_tetes", [
    ("GET", "/api/v1/planning/access", NAVIGATEUR),   # /api/ : toujours du JSON
    ("GET", "/x", {"Accept": "application/json"}),
    ("POST", "/x", {}),
])
def test_module_arrete_json_pour_les_api(methode, chemin, en_tetes):
    r = requests.request(methode, f"{ATTENTE}{chemin}", headers=en_tetes)
    _attente(r, "application/json")
    assert r.json() == {"detail": "maintenance"}


def test_erreur_502_du_module_devient_page_d_attente():
    _attente(requests.get(f"{EDGE_URL}/cr/statut/502", headers=NAVIGATEUR), "text/html")
    _attente(requests.get(f"{LAN_CR}/cr/statut/503"), "application/json")


@pytest.mark.parametrize("chemin, code", [("/statut/404", 404), ("/statut/500", 500), ("/cr/statut/403", 403)])
def test_autres_erreurs_du_module_intactes(chemin, code):
    r = requests.get(f"{EDGE_URL}{chemin}", headers=NAVIGATEUR)
    assert r.status_code == code and r.json()["statut"] == code
    assert "Retry-After" not in r.headers and "Cache-Control" not in r.headers


@pytest.mark.parametrize("chemin", ["/_edge/attente.html", "/_edge/attente.json"])
def test_page_d_attente_inaccessible_en_direct(chemin):
    assert requests.get(f"{EDGE_URL}{chemin}").status_code == 404


def test_journaux_json_sans_query_string():
    requests.get(f"{EDGE_HTTPS_URL}/?code=SECRET-123")
    conteneur = os.environ.get("EDGE_CONTENEUR_HTTPS", "edge-https")
    sortie = subprocess.run(["docker", "logs", conteneur], capture_output=True, text=True).stdout
    assert "SECRET-123" not in sortie
    lignes = [ligne for ligne in sortie.splitlines() if ligne.startswith("{")]
    assert lignes and all(k in lignes[-1] for k in ('"module"', '"status"', '"path"', '"req_id"'))
