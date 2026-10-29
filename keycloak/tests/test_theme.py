"""Cohérence statique du thème de connexion `cfao-academy`.

Le ✕ de la carte est un lien : la règle générale des liens de la page
(`.login-pf-page a`) fixe sa couleur en `!important`. Sans `!important` à son
tour, le ✕ hérite du blanc des liens et disparaît sur son fond blanc.
"""
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
CSS = RACINE / "keycloak" / "themes" / "cfao-academy" / "login" / "resources" / "css" / "cfao.css"
REGLE = re.compile(r"([^{}]+)\{([^{}]*)\}")
DECLARATION = re.compile(r"([a-z-]+)\s*:\s*([^;]+);")


def _proprietes_importantes(selecteur):
    """Propriétés déclarées en !important par chaque règle dont la liste contient `selecteur`."""
    sans_commentaires = re.sub(r"/\*.*?\*/", "", CSS.read_text(encoding="utf-8"), flags=re.S)
    trouvees = set()
    for selecteurs, corps in REGLE.findall(sans_commentaires):
        if selecteur in (s.strip() for s in selecteurs.split(",")):
            trouvees |= {nom for nom, valeur in DECLARATION.findall(corps) if "!important" in valeur}
    return trouvees


def test_le_lien_de_fermeture_impose_ce_que_la_regle_des_liens_impose():
    imposees = _proprietes_importantes(".login-pf-page a") & {"color", "font-size"}
    assert imposees, "la règle des liens a changé : revoir ce test"
    assert imposees <= _proprietes_importantes(".login-pf-page .card-pf .cfao-close")


def test_le_survol_du_lien_de_fermeture_reste_visible():
    assert "color" in _proprietes_importantes(".login-pf-page .card-pf .cfao-close:hover")
