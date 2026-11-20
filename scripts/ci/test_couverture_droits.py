"""Couverture des droits : chaque `kind` passe au PEP d'un module a sa resource
policy dans le Cerbos partage (`cerbos/policies/resource_policies/`).

Sans elle, Cerbos refuse tout (default-deny) : l'ecran tombe en 403 en recette.
Ici, c'est rouge en CI.

Lecture statique (AST) du code des modules `cfao-*`, hors tests :
- attribut de vue `cerbos_resource_kind = "<kind>"` ;
- appels `cerbos.check|check_many|plan(principal, <kind>, ...)` ;
- aides PEP des modules : `allow(request, <kind>, ...)` (planning),
  `_autoriser`, `_permis`, `_permis_lot`, `_exiger(request, <kind>, ...)`
  (comptes rendus).
Le `kind` est une chaine ou une constante de module ; un parametre (aide
generique) n'est pas resolu ici, ses appelants le sont.
"""
import ast
import functools
import os
from pathlib import Path

import pytest
import yaml

RACINE = Path(__file__).resolve().parents[2]
POLICIES = RACINE / "cerbos" / "policies" / "resource_policies"
EXCLUS = {"tests", ".venv", "venv", "site-packages", "node_modules", "migrations", "__pycache__"}

# Fonction PEP -> position du kind (0 = premier argument).
APPELS_CERBOS = {"check": 1, "check_many": 1, "plan": 1}
AIDES_PEP = {"allow": 1, "_autoriser": 1, "_permis": 1, "_permis_lot": 1, "_exiger": 1}


def kinds_des_policies() -> set[str]:
    kinds = set()
    for fichier in POLICIES.rglob("*.yaml"):
        for doc in yaml.safe_load_all(fichier.read_text(encoding="utf-8")):
            if doc and "resourcePolicy" in doc:
                kinds.add(doc["resourcePolicy"]["resource"])
    return kinds


def _fichiers():
    for module in sorted(RACINE.glob("cfao-*")):
        for dossier, sous, noms in os.walk(module):
            sous[:] = [s for s in sous if s not in EXCLUS]  # ni dependances ni tests
            yield from (Path(dossier) / n for n in noms if n.endswith(".py"))


def _constantes(arbre: ast.Module) -> dict[str, str]:
    return {cible.id: n.value.value
            for n in arbre.body if isinstance(n, ast.Assign)
            and isinstance(n.value, ast.Constant) and isinstance(n.value.value, str)
            for cible in n.targets if isinstance(cible, ast.Name)}


def _valeur(noeud, constantes) -> str | None:
    if isinstance(noeud, ast.Constant) and isinstance(noeud.value, str):
        return noeud.value
    if isinstance(noeud, ast.Name):
        return constantes.get(noeud.id)
    return None


def _kind_de_l_appel(appel: ast.Call, constantes) -> str | None:
    f = appel.func
    if isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name) and f.value.id == "cerbos":
        position = APPELS_CERBOS.get(f.attr)
    elif isinstance(f, ast.Name):
        position = AIDES_PEP.get(f.id)
    else:
        return None
    if position is None:
        return None
    for mot in appel.keywords:
        if mot.arg == "kind":
            return _valeur(mot.value, constantes)
    return _valeur(appel.args[position], constantes) if len(appel.args) > position else None


@functools.cache
def kinds_du_code() -> dict[str, set[str]]:
    """{kind: {fichier:ligne, ...}}."""
    trouves: dict[str, set[str]] = {}
    for f in _fichiers():
        arbre = ast.parse(f.read_text(encoding="utf-8"), filename=str(f))
        constantes = _constantes(arbre)
        for n in ast.walk(arbre):
            kind = None
            if isinstance(n, ast.Call):
                kind = _kind_de_l_appel(n, constantes)
            elif isinstance(n, ast.Assign) and any(
                    isinstance(c, ast.Name) and c.id == "cerbos_resource_kind" for c in n.targets):
                kind = _valeur(n.value, constantes)
            if kind:
                trouves.setdefault(kind, set()).add(f"{f.relative_to(RACINE).as_posix()}:{n.lineno}")
    return trouves


def test_chaque_kind_du_code_a_sa_resource_policy():
    manquants = {k: sorted(o) for k, o in kinds_du_code().items() if k not in kinds_des_policies()}
    assert manquants == {}, (
        "kind passe au PEP sans resource policy dans cerbos/policies/resource_policies/ "
        f"(Cerbos refusera tout, 403) : {manquants}")


@pytest.mark.parametrize("module, attendus", [
    ("cfao-comptes-rendus", {"compte_rendu", "compte_rendu_photo", "compte_rendu_rendu",
                             "compte_rendu_journal", "session_formation", "referentiel"}),
    ("cfao-planning", {"planning_cost_key", "planning_import"}),
    ("cfao-needs", {"needs_campaign"}),
    ("cfao-core", {"user_account", "role_assignment", "course"}),
])
def test_la_lecture_voit_les_kinds_des_modules(module, attendus):
    """Garde de la garde : une lecture qui ne voit rien laisserait tout passer."""
    vus = {k for k, o in kinds_du_code().items() if any(x.startswith(module + "/") for x in o)}
    assert attendus <= vus, attendus - vus
