"""Smoke de la connexion par code mail (extension cfao-password-or-email-form), de bout en bout.

Même pile isolée que smoke_hub_mail.py (keycloak/tests/compose.hub.smoke.yml), à lancer
sur une pile neuve : les limites (3 demandes / 15 min) et les alertes (1 / adresse / jour)
gardent leur état entre deux passages. Prouve, sur la vraie image et le vrai hub :
- adresse inconnue : même page qu'une adresse connue, une seule alerte support par jour ;
- compte désactivé : alerte support ; super admin : aucun mail ;
- code reçu → jeton OIDC ; code rejoué refusé ; le lien meurt une fois le code utilisé ;
- lien ouvert dans un autre navigateur : session SSO ouverte, le code devient inutile ;
- 4e demande en 15 min : aucun mail.
"""
import html
import re
import time
from urllib.parse import parse_qs, urljoin, urlparse

import pytest
import requests

from smoke_hub_mail import COMPOSE, KC_URL, LIEN, OIDC, _attendre, _compose, _messages, _texte_visible

CONNU = "kouame.assi@cfao.example"
INCONNU = "k.inconnu@cfao.example"  # même initiale : même adresse masquée sur la page
LIMITE = "mail.limite@cfao.example"
DESACTIVE = "compte.desactive@cfao.example"
SUPER_ADMIN = "super.admin@cfao.example"
RAPPEL = "http://localhost:8000/oauth2/callback"
CODE = re.compile(r"(?m)^(\d{3}) (\d{3})\s*$")

assert COMPOSE


def _securiser(s):
    for cookie in s.cookies:  # cookies Secure sur http://localhost (même astuce que smoke_realm.py)
        cookie.secure = False


def _action(page, form_id):
    m = re.search(rf'<form id="{form_id}"[^>]*action="([^"]*)"', page.text)
    assert m, f"formulaire {form_id} absent ({page.status_code}) : {_texte_visible(page)[:300]}"
    return urljoin(page.url, html.unescape(m.group(1)))


def _ouvrir(prompt=None, s=None):
    s = s or requests.Session()
    params = {"client_id": "cfao-portal", "response_type": "code", "redirect_uri": RAPPEL, "scope": "openid"}
    if prompt:
        params["prompt"] = prompt
    r = s.get(f"{OIDC}/auth", params=params, allow_redirects=False)
    _securiser(s)
    return s, r


def _demander(adresse):
    """Connexion → « recevoir un code » → saisie de l'adresse : (session, page code, durée en s)."""
    s, page = _ouvrir()
    assert page.status_code == 200, page.status_code
    page = s.post(_action(page, "cfao-mail-login"), data={"cfao_action": "email"})
    assert 'id="cfao-email-request"' in page.text, _texte_visible(page)[:300]
    debut = time.monotonic()
    page = s.post(_action(page, "cfao-email-request"), data={"cfao_action": "send", "email": adresse})
    duree = time.monotonic() - debut
    _securiser(s)
    assert 'id="cfao-email-code"' in page.text, _texte_visible(page)[:300]
    return s, page, duree


def _blocs(adresse):
    """Mails affichés par le backend console du worker (« [mail] to=[...] ») pour `adresse`."""
    journal = _compose("logs", "--no-log-prefix", "mail-worker")
    return [b for b in journal.split("\n[mail] to=")[1:] if f"'{adresse}'" in b.split("\n", 1)[0]]


def _mails(adresse):
    """Mails reçus par `adresse`, dans l'ordre : [(code, lien)]."""
    recus = []
    for bloc in _blocs(adresse):
        code, lien = CODE.search(bloc), LIEN.search(bloc)
        recus.append(("".join(code.groups()) if code else None, lien.group(0) if lien else None))
    return recus


def _nouveau_mail(adresse, avant):
    return _attendre(lambda: _mails(adresse)[avant] if len(_mails(adresse)) > avant else None, 60)


def _nombre(kind, statut="SENT"):
    return _messages().splitlines().count(f"{kind}:{statut}")


def _suivre(s, r):
    """Suit les redirections internes à Keycloak ; s'arrête à la première sortie (le module)."""
    while r.status_code in (302, 303) and urljoin(r.url, r.headers["Location"]).startswith(KC_URL):
        _securiser(s)  # cookies posés par la réponse précédente, avant de les renvoyer
        r = s.get(urljoin(r.url, r.headers["Location"]), allow_redirects=False)
    _securiser(s)
    return r


def _jeton(r):
    assert r.status_code in (302, 303), (r.status_code, _texte_visible(r)[:300])
    sortie = r.headers["Location"]
    assert sortie.startswith(RAPPEL), sortie
    code = parse_qs(urlparse(sortie).query)["code"][0]
    t = requests.post(f"{OIDC}/token", data={"grant_type": "authorization_code", "code": code,
                                              "redirect_uri": RAPPEL, "client_id": "cfao-portal",
                                              "client_secret": "smoke-portal-secret"})
    assert t.status_code == 200, t.text
    return t.json()


def _autorise(r):
    """Vrai si la réponse remet un code d'autorisation au module (une erreur renvoyée n'en est pas un)."""
    sortie = r.headers.get("Location", "")
    return sortie.startswith(RAPPEL) and "code" in parse_qs(urlparse(sortie).query)


def _saisir(s, page, code):
    return s.post(_action(page, "cfao-email-code"), data={"cfao_action": "code", "code": code},
                  allow_redirects=False)


def test_la_page_de_connexion_propose_le_code_mail():
    _, page = _ouvrir()
    assert 'id="cfao-mail-login-start"' in page.text and 'id="kc-form-login"' in page.text


def _changer_langue(s, page, code):
    m = re.search(rf'href="([^"]*kc_locale={code}[^"]*)"', page.text)
    assert m, "lien de langue absent"
    r = s.get(urljoin(page.url, html.unescape(m.group(1))))
    _securiser(s)
    return r


def test_changer_de_langue_garde_la_page_du_code_mail():
    s, page = _ouvrir()
    page = s.post(_action(page, "cfao-mail-login"), data={"cfao_action": "email"})
    _securiser(s)
    page = _changer_langue(s, page, "pt")
    assert 'id="cfao-email-request"' in page.text, _texte_visible(page)[:300]
    assert 'lang="pt"' in page.text
    # Retour au mot de passe : un nouveau changement de langue y reste.
    page = s.post(_action(page, "cfao-email-request"), data={"cfao_action": "back"})
    _securiser(s)
    page = _changer_langue(s, page, "fr")
    assert 'id="kc-form-login"' in page.text and 'id="cfao-email-request"' not in page.text


def test_adresse_inconnue_meme_page_et_une_seule_alerte_par_jour():
    avant = len(_mails(CONNU))
    _, connu, duree_connu = _demander(CONNU)
    _, inconnu, duree_inconnu = _demander(INCONNU)
    assert _texte_visible(connu) == _texte_visible(inconnu)
    assert "k***@cfao.example" in _texte_visible(connu)
    assert max(duree_connu, duree_inconnu) < 3, (duree_connu, duree_inconnu)
    _nouveau_mail(CONNU, avant)
    _attendre(lambda: _nombre("identity.login_support_alert") == 1)
    alerte = _attendre(lambda: _blocs("support@cfao.example"), 30)
    assert len(alerte) == 1
    assert alerte[0].split("\n", 1)[0].endswith(f"reply_to={INCONNU}")
    assert "Aucun compte actif" in alerte[0]
    # Même adresse, même jour : pas de seconde alerte.
    _demander(INCONNU)
    time.sleep(5)
    assert _nombre("identity.login_support_alert") == 1
    assert _mails(INCONNU) == []


def test_compte_desactive_alerte_le_support_et_super_admin_ne_recoit_rien():
    alertes, codes = _nombre("identity.login_support_alert"), _nombre("identity.login_code")
    _demander(DESACTIVE)
    _demander(SUPER_ADMIN)
    _attendre(lambda: _nombre("identity.login_support_alert") == alertes + 1)
    time.sleep(5)
    assert _nombre("identity.login_code") == codes
    assert _mails(DESACTIVE) == [] and _mails(SUPER_ADMIN) == []
    alertes = _attendre(lambda: _blocs("support@cfao.example")[1:], 30)
    assert DESACTIVE in alertes[0] and "Compte désactivé" in alertes[0]
    assert SUPER_ADMIN not in "".join(_blocs("support@cfao.example"))


def test_code_donne_un_jeton_puis_ne_sert_plus_et_le_lien_meurt():
    avant = len(_mails(CONNU))
    s, page, _ = _demander(CONNU)
    code, lien = _nouveau_mail(CONNU, avant)
    assert code and lien and lien.startswith(KC_URL)
    # Mauvais code d'abord : refusé, la page reste celle du code.
    faux = s.post(_action(page, "cfao-email-code"), data={"cfao_action": "code", "code": "000000"
                                                          if code != "000000" else "111111"})
    assert 'id="cfao-email-code"' in faux.text
    # Erreur sous le champ, reliée à lui, et une seule fois (pas de bandeau en double).
    assert 'aria-invalid="true"' in faux.text and faux.text.count('id="input-error"') == 1
    assert 'aria-describedby="cfao-code-sent input-error"' in faux.text
    assert "pf-c-alert" not in faux.text
    r = _suivre(s, _saisir(s, faux, f"{code[:3]} {code[3:]}"))
    jeton = _jeton(r)
    assert jeton["access_token"]
    # Rejeu du même code : aucune nouvelle autorisation.
    assert not _autorise(_suivre(s, _saisir(s, faux, code)))
    # Le lien du même mail ne sert plus.
    mort = requests.get(lien, allow_redirects=False)
    assert mort.status_code == 400, (mort.status_code, mort.headers.get("Location"))
    # Le code et le lien ne restent pas dans la base du hub.
    dump = _compose("exec", "-T", "mail-db", "pg_dump", "-U", "cfao_mail", "-d", "cfao_mail", "--data-only")
    assert "action-token" not in dump


def test_lien_dans_le_meme_navigateur_termine_la_connexion():
    avant = len(_mails(CONNU))
    s, _, _ = _demander(CONNU)
    _, lien = _nouveau_mail(CONNU, avant)
    assert _jeton(_suivre(s, s.get(lien, allow_redirects=False)))["access_token"]
    # Rejeu du lien : refusé.
    assert requests.get(lien, allow_redirects=False).status_code == 400


def test_lien_dans_un_autre_navigateur_ouvre_la_session_et_tue_le_code():
    avant = len(_mails(LIMITE))
    s, page, _ = _demander(LIMITE)
    code, lien = _nouveau_mail(LIMITE, avant)
    autre = requests.Session()
    r = _suivre(autre, autre.get(lien, allow_redirects=False))
    assert r.status_code in (302, 303), (r.status_code, _texte_visible(r)[:300])
    assert r.headers["Location"].startswith("http://localhost:8000/"), r.headers["Location"]
    assert "code=" not in r.headers["Location"]
    # Session SSO ouverte dans l'autre navigateur : connexion silencieuse au module.
    _, silencieux = _ouvrir(prompt="none", s=autre)
    assert _jeton(_suivre(autre, silencieux))["access_token"]
    # Le code du même mail ne sert plus dans le premier navigateur.
    assert not _autorise(_suivre(s, _saisir(s, page, code)))


def test_quatrieme_demande_en_quinze_minutes_n_envoie_rien():
    # Première demande faite par le test précédent : deux autres passent, la quatrième non.
    for _ in range(2):
        avant = len(_mails(LIMITE))
        _demander(LIMITE)
        _nouveau_mail(LIMITE, avant)
    avant = len(_mails(LIMITE))
    _, page, _ = _demander(LIMITE)
    assert "m***@cfao.example" in _texte_visible(page)  # même page : rien ne trahit la limite
    time.sleep(8)
    assert len(_mails(LIMITE)) == avant
