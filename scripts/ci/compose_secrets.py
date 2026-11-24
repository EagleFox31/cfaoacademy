"""Garde des secrets des compose de prod (PLAN-secrets.md, étape 7).

Refuse, pour toute variable dont le nom désigne un secret :
- une valeur par défaut non vide (`${X:-defaut}`, `${X-defaut}`) : le défaut est
  public dans le dépôt, la prod tournerait avec ;
- une valeur par défaut vide (`${X:-}`), sauf exception justifiée ci-dessous
  (secret vide = fonction refusée, jamais ouverte) ;
- une valeur écrite en clair (`MOT_DE_PASSE: abc`).

Le secret attendu s'écrit `${X:?message}` : compose refuse de démarrer sans lui.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]

# Mots qui désignent un secret dans un nom de variable découpé sur « _ ».
MOTS_SECRETS = {"PASSWORD", "PASSWD", "SECRET", "TOKEN", "PEPPER", "KEY", "CREDENTIALS"}

# Défaut vide accepté : la valeur vide coupe la fonction (fail-closed).
VIDES_ACCEPTES = {
    "NEEDS_CATALOG_WRITE_INBOUND_KEY": "handshake : clé vide = écriture du catalogue refusée",
    "NEEDS_CATALOG_WRITE_KEY": "handshake : clé vide = écriture du catalogue refusée",
    "CFAO_IDENTITY_MAIL_KEY": "hub mail : url et clé vont ensemble, sinon Keycloak refuse de démarrer",
}

REFERENCE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(:?-)([^}]*)\}")
AFFECTATION = re.compile(r"^\s*(?:-\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*(.*?)\s*$")


def est_secret(nom: str) -> bool:
    mots = nom.upper().split("_")
    if mots[-1] == "FILE":  # chemin vers un secret monté, pas le secret
        return False
    return bool(MOTS_SECRETS.intersection(mots))


def check(texte: str, chemin: str = "<compose>") -> list[str]:
    erreurs = []
    for numero, ligne in enumerate(texte.splitlines(), 1):
        code = ligne.split(" #", 1)[0] if not ligne.lstrip().startswith("#") else ""
        if not code.strip():
            continue
        for nom, _, defaut in REFERENCE.findall(code):
            if not est_secret(nom):
                continue
            if defaut:
                erreurs.append(f"{chemin}:{numero}: {nom} a une valeur par défaut (publique)")
            elif nom not in VIDES_ACCEPTES:
                erreurs.append(f"{chemin}:{numero}: {nom} a un défaut vide ; exiger ${{{nom}:?…}}")
        affectation = AFFECTATION.match(code)
        if affectation:
            nom, valeur = affectation.groups()
            valeur = valeur.strip("'\"")
            if est_secret(nom) and valeur and "${" not in valeur:
                erreurs.append(f"{chemin}:{numero}: {nom} est écrit en clair")
    return erreurs


def composes_de_prod() -> list[Path]:
    sortie = subprocess.run(
        ["git", "ls-files", "*compose*prod*.yml", "*compose*prod*.yaml", "*/serveur/compose*.yaml"],
        cwd=RACINE, capture_output=True, text=True, check=True,
    ).stdout
    return [RACINE / p for p in sortie.split() if "/tests/" not in p]


def main() -> int:
    erreurs = []
    fichiers = composes_de_prod()
    for fichier in fichiers:
        relatif = fichier.relative_to(RACINE).as_posix()
        erreurs += check(fichier.read_text(encoding="utf-8"), relatif)
    for erreur in erreurs:
        print(erreur)
    print(f"{len(fichiers)} compose de prod, {len(erreurs)} erreur(s)")
    return 1 if erreurs else 0


if __name__ == "__main__":
    sys.exit(main())
