"""Cohérence statique du thème de connexion `cfao-academy`.

La règle générale des liens de la page (`.login-pf-page a`) fixe leur couleur en
`!important` (blanc). Le ✕ de la carte en avait hérité et avait disparu sur son
fond blanc. Depuis, la barre du haut (« ← Accueil », langue) est créée
dans <body>, hors de `.login-pf-page` : la règle ne peut plus l'atteindre.
"""
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
RESSOURCES = RACINE / "keycloak" / "themes" / "cfao-academy" / "login" / "resources"
CSS = RESSOURCES / "css" / "cfao.css"
JS = RESSOURCES / "js" / "login.js"


def _css():
    return re.sub(r"/\*.*?\*/", "", CSS.read_text(encoding="utf-8"), flags=re.S)


def test_la_barre_du_haut_echappe_a_la_regle_des_liens_de_la_carte():
    js = JS.read_text(encoding="utf-8")
    assert "document.body.insertBefore(barre" in js
    assert ".login-pf-page .cfao-topbar" not in _css()
    # Sortie vers l'accueil en texte visible ; un seul logo, celui de la carte.
    assert "home.href = '/'" in js and "Accueil" in js
    assert "logo" not in _css().split(".cfao-topbar-home")[1].split("}")[0]


def test_langues_sans_drapeaux_et_dans_leur_propre_langue():
    css, js = _css(), JS.read_text(encoding="utf-8")
    assert "flag" not in css.lower()
    for nom in ("Français", "English", "Português"):
        assert nom in js
    assert "setAttribute('lang', code)" in js


def test_exemple_du_champ_traduit():
    js = JS.read_text(encoding="utf-8")
    for exemple in ("prenom.nom@", "nome.apelido@", "firstname.lastname@"):
        assert exemple in js
    assert "setAttribute('placeholder', 'ex. prenom" not in js
