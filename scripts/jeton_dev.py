"""Jeton d'accès de dev pour un compte de démo, par le vrai flux code + PKCE.

Remplace le grant password de `cfao-spa`, retiré du realm (constat 14). Lancé par
`make token U=<compte>` dans le conteneur core (stdlib seule) :
    docker compose exec -T core python - kouame.assi < scripts/jeton_dev.py
Variables : KC_URL (défaut http://keycloak:8080), MOT_DE_PASSE (défaut « demo »).
Affiche le seul jeton d'accès sur la sortie standard.
"""
import base64
import hashlib
import html
import http.cookiejar
import json
import os
import re
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request

KC_URL = os.environ.get("KC_URL", "http://keycloak:8080").rstrip("/")
OIDC = f"{KC_URL}/realms/cfao/protocol/openid-connect"
CLIENT = "cfao-spa"
RAPPEL = "http://localhost:5173/callback"


class _SansSuivre(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def _ouvreur():
    jarre = http.cookiejar.CookieJar()
    ouvreur = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jarre), _SansSuivre)
    return jarre, ouvreur


def _appel(ouvreur, url, donnees=None):
    corps = urllib.parse.urlencode(donnees).encode() if donnees is not None else None
    try:
        with ouvreur.open(url, corps) as r:
            return r.status, r.headers, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read().decode(errors="replace")


def jeton(utilisateur, mot_de_passe):
    verif = secrets.token_urlsafe(48)
    defi = base64.urlsafe_b64encode(hashlib.sha256(verif.encode()).digest()).rstrip(b"=").decode()
    jarre, ouvreur = _ouvreur()
    statut, _, page = _appel(ouvreur, f"{OIDC}/auth?" + urllib.parse.urlencode({
        "client_id": CLIENT, "redirect_uri": RAPPEL, "response_type": "code", "scope": "openid",
        "code_challenge": defi, "code_challenge_method": "S256"}))
    formulaire = re.search(r'<form[^>]*id="kc-form-login"[^>]*>', page)
    if statut != 200 or not formulaire:
        sys.exit(f"page de connexion introuvable ({statut})")
    # Keycloak pose ses cookies en Secure ; on les renvoie sur http, comme un navigateur
    # le fait pour localhost.
    for cookie in jarre:
        cookie.secure = False
    action = html.unescape(re.search(r'action="([^"]+)"', formulaire.group(0)).group(1))
    statut, entetes, _ = _appel(ouvreur, action, {"username": utilisateur, "password": mot_de_passe})
    lieu = entetes.get("Location", "") if statut == 302 else ""
    if not lieu.startswith(RAPPEL):
        sys.exit(f"connexion refusée ({statut})")
    code = urllib.parse.parse_qs(urllib.parse.urlparse(lieu).query)["code"][0]
    statut, _, corps = _appel(ouvreur, f"{OIDC}/token", {
        "grant_type": "authorization_code", "client_id": CLIENT, "code": code,
        "redirect_uri": RAPPEL, "code_verifier": verif})
    if statut != 200:
        sys.exit(f"échange du code refusé ({statut})")
    return json.loads(corps)["access_token"]


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage : python jeton_dev.py <compte>")
    print(jeton(sys.argv[1], os.environ.get("MOT_DE_PASSE", "demo")))
