"""Smoke de l'extension cfao-hub : « mot de passe oublié » de bout en bout.

Pile isolée keycloak/tests/compose.hub.smoke.yml (mode d'emploi en tête du fichier).
Prouve, sur la vraie image Keycloak et le vrai hub :
- hub arrêté : Keycloak répond pareil et vite, l'échec reste dans son journal ;
- adresse inconnue : même réponse qu'une adresse connue, aucun message créé ;
- adresse connue : message identity.password_reset SENT, lien absent de la base du hub,
  lien reçu (console du worker) qui ouvre le changement de mot de passe.
"""
import html
import os
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import urljoin

import pytest
import requests

KC_URL = os.environ.get("KC_URL", "").rstrip("/")
COMPOSE = os.environ.get("SMOKE_COMPOSE", "")
OIDC = f"{KC_URL}/realms/cfao/protocol/openid-connect"
CONNU, INCONNU = "kouame.assi@cfao.example", "personne.inconnue@cfao.example"
LIEN = re.compile(r"https?://[^\s\"'<>]+/login-actions/action-token\?[^\s\"'<>]+")

if not (KC_URL and COMPOSE):
    pytest.fail("KC_URL et SMOKE_COMPOSE sont obligatoires (pile du smoke démarrée).", pytrace=False)


def _compose(*args, check=True):
    racine = Path(__file__).resolve().parents[2]
    r = subprocess.run(["docker", "compose", "-f", COMPOSE, *args], cwd=racine,
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check:
        assert r.returncode == 0, r.stderr[-800:]
    return r.stdout


def _sql(requete):
    return _compose("exec", "-T", "mail-db", "psql", "-U", "cfao_mail", "-d", "cfao_mail",
                    "-tA", "-c", requete).strip()


def _messages():
    return _sql("select kind || ':' || status from outbound_outboundmessage order by created_at")


def _demande(adresse):
    """Login → « mot de passe oublié » → saisie : (session, page rendue, durée en s)."""
    s = requests.Session()
    page = s.get(f"{OIDC}/auth", params={"client_id": "cfao-portal", "response_type": "code",
                                          "redirect_uri": "http://localhost:8000/oauth2/callback",
                                          "scope": "openid"})
    page.raise_for_status()
    for cookie in s.cookies:  # même astuce que smoke_realm.py : http://localhost
        cookie.secure = False
    oubli = re.search(r'href="([^"]*login-actions/reset-credentials[^"]*)"', page.text)
    assert oubli, "lien « mot de passe oublié » absent de la page de connexion"
    page = s.get(urljoin(page.url, html.unescape(oubli.group(1))))
    action = re.search(r'<form[^>]*action="([^"]*reset-credentials[^"]*)"', page.text)
    assert action, f"formulaire de réinitialisation absent ({page.status_code})"
    debut = time.monotonic()
    r = s.post(urljoin(page.url, html.unescape(action.group(1))), data={"username": adresse})
    return s, r, time.monotonic() - debut


def _texte_visible(r):
    """Ce que voit l'utilisateur : texte hors balises, scripts et styles retirés."""
    corps = re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", r.text)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", corps)).split())


def _attendre(condition, delai=60):
    fin = time.monotonic() + delai
    while time.monotonic() < fin:
        valeur = condition()
        if valeur:
            return valeur
        time.sleep(1)
    pytest.fail("délai dépassé")


def _lien_recu():
    """Lien du dernier mail affiché par le backend console du worker (texte entier)."""
    liens = LIEN.findall(_compose("logs", "--no-log-prefix", "mail-worker"))
    return liens[-1] if liens else None


def test_hub_arrete_le_flux_repond_pareil_et_vite():
    _compose("stop", "mail-api", "mail-worker")
    try:
        _, connu, duree_connu = _demande(CONNU)
        _, inconnu, duree_inconnu = _demande(INCONNU)
        assert connu.status_code == inconnu.status_code == 200
        assert _texte_visible(connu) == _texte_visible(inconnu)
        assert max(duree_connu, duree_inconnu) < 3, (duree_connu, duree_inconnu)
        def echec_journalise():
            j = _compose("logs", "keycloak")
            return j if "cfao-hub" in j and "non envoyé" in j else None

        journal = _attendre(echec_journalise, 20)
        assert "action-token" not in journal  # l'échec est journalisé sans le lien
        assert _messages() == ""
    finally:
        _compose("up", "-d", "--wait", "mail-api", "mail-worker")


def test_adresse_inconnue_meme_reponse_et_aucun_message():
    _, connu, duree_connu = _demande(CONNU)
    _, inconnu, duree_inconnu = _demande(INCONNU)
    assert _texte_visible(connu) == _texte_visible(inconnu)
    assert max(duree_connu, duree_inconnu) < 3, (duree_connu, duree_inconnu)
    # Seule l'adresse connue produit un message.
    assert _attendre(lambda: _messages() or None, 20).startswith("identity.password_reset:")
    time.sleep(3)
    assert len(_messages().splitlines()) == 1


def test_lien_porte_par_le_hub_ouvre_le_changement_de_mot_de_passe():
    s, _, _ = _demande(CONNU)
    _attendre(lambda: _messages().splitlines().count("identity.password_reset:SENT") == 2)
    # Le lien n'existe qu'en clair dans le mail : ni le contexte ni le journal du hub ne le gardent.
    dump = _compose("exec", "-T", "mail-db", "pg_dump", "-U", "cfao_mail", "-d", "cfao_mail", "--data-only")
    assert "action-token" not in dump and "login-actions" not in dump
    lien = _attendre(_lien_recu, 30)
    assert lien.startswith(KC_URL)
    page = s.get(lien)
    assert page.status_code == 200, page.status_code
    assert 'name="password-new"' in page.text, _texte_visible(page)[:300]
