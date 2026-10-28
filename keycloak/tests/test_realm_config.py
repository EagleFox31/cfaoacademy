"""Cohérence statique du realm commun `cfao` (fédération L3).

Le realm est la source des rôles (claim `realm_access.roles`) et des audiences :
un rôle que Cerbos attend sans que Keycloak le délivre, ou une API sans client
cible d'audience, ne se voit qu'en production. Ces tests le voient avant.
"""
import ast
import re
from pathlib import Path

import pytest
import yaml

RACINE = Path(__file__).resolve().parents[2]
REALM = RACINE / "keycloak" / "config" / "cfao-realm.yaml"
POLICIES = RACINE / "cerbos" / "policies"
CATALOGUE = RACINE / "cfao-core" / "identity" / "roles.py"

API = ("core", "needs", "cr", "planning", "operations")
SESSION_MAX = 8 * 3600
INACTIVITE_MAX = 30 * 60  # ASVS niveau 2, 3.3.2
# Scopes fournis par Keycloak lui-même (non déclarés dans le fichier).
SCOPES_NATIFS = {"basic", "web-origins", "profile", "roles", "email", "acr", "address", "phone",
                 "offline_access", "microprofile-jwt", "organization"}
_API_PORTAIL = {"cfao-core-api", "cfao-cr-api", "cfao-planning-api", "cfao-operations-api"}
SUBSTITUTION = re.compile(r"^\$\(env:[A-Z0-9_]+(:-.*)?\)$")


@pytest.fixture(scope="module")
def realm():
    return yaml.safe_load(REALM.read_text(encoding="utf-8"))


def _clients(realm):
    return {c["clientId"]: c for c in realm["clients"]}


def _scopes(realm):
    return {s["name"]: s for s in realm["clientScopes"]}


def _roles_realm(realm):
    return {r["name"] for r in realm["roles"]["realm"]}


def _roles_policies():
    trouves = set()

    def parcourir(noeud):
        if isinstance(noeud, dict):
            for cle, valeur in noeud.items():
                if cle in ("roles", "parentRoles") and isinstance(valeur, list):
                    trouves.update(v for v in valeur if isinstance(v, str))
                else:
                    parcourir(valeur)
        elif isinstance(noeud, list):
            for v in noeud:
                parcourir(v)

    for fichier in POLICIES.rglob("*.yaml"):
        for doc in yaml.safe_load_all(fichier.read_text(encoding="utf-8")):
            parcourir(doc)
    return trouves - {"*"}


def test_realm_unique_cfao(realm):
    assert realm["realm"] == "cfao"


def test_roles_identiques_au_catalogue_core(realm):
    arbre = ast.parse(CATALOGUE.read_text(encoding="utf-8"))
    catalogue = next(n.value for n in arbre.body
                     if isinstance(n, ast.Assign) and n.targets[0].id == "ROLE_CATALOG")
    codes = {d["code"] for d in ast.literal_eval(catalogue)}
    assert codes == _roles_realm(realm)


def test_tout_role_des_policies_existe_dans_le_realm(realm):
    manquants = _roles_policies() - _roles_realm(realm)
    assert not manquants, f"rôles attendus par Cerbos, absents du realm : {sorted(manquants)}"


def test_session_huit_heures_et_inactivite_trente_minutes(realm):
    for cle in ("ssoSessionIdleTimeout", "ssoSessionMaxLifespan",
                "clientSessionIdleTimeout", "clientSessionMaxLifespan"):
        assert realm[cle] <= SESSION_MAX, cle
    assert realm["ssoSessionMaxLifespan"] == SESSION_MAX
    assert realm["ssoSessionIdleTimeout"] <= INACTIVITE_MAX
    assert realm["clientSessionIdleTimeout"] <= INACTIVITE_MAX
    assert realm["rememberMe"] is False
    assert realm["bruteForceProtected"] is True


@pytest.mark.parametrize("module", API)
def test_chaque_api_a_son_client_bearer_only(realm, module):
    client = _clients(realm)[f"cfao-{module}-api"]
    assert client["bearerOnly"] is True
    assert client["publicClient"] is False
    for flux in ("standardFlowEnabled", "implicitFlowEnabled",
                 "directAccessGrantsEnabled", "serviceAccountsEnabled"):
        assert client[flux] is False, flux
    assert "secret" not in client


@pytest.mark.parametrize("module", API)
def test_chaque_api_a_son_scope_d_audience(realm, module):
    scope = _scopes(realm)[f"aud-cfao-{module}-api"]
    (mapper,) = scope["protocolMappers"]
    assert mapper["protocolMapper"] == "oidc-audience-mapper"
    assert mapper["config"]["included.client.audience"] == f"cfao-{module}-api"
    assert mapper["config"]["access.token.claim"] == "true"


def test_toute_audience_vise_un_client_existant(realm):
    clients = _clients(realm)
    for scope in realm["clientScopes"]:
        for m in scope.get("protocolMappers", []):
            if m["protocolMapper"] == "oidc-audience-mapper":
                assert m["config"]["included.client.audience"] in clients, scope["name"]


def test_scopes_par_defaut_declares(realm):
    connus = SCOPES_NATIFS | set(_scopes(realm))
    for client in realm["clients"]:
        inconnus = set(client.get("defaultClientScopes", [])) - connus
        assert not inconnus, f"{client['clientId']} : {sorted(inconnus)}"


@pytest.mark.parametrize("client_id, attendues", [
    ("cfao-portal", _API_PORTAIL),
    ("cfao-spa", _API_PORTAIL),
    ("cfao-needs-web", {"cfao-needs-api"}),
])
def test_audiences_par_client(realm, client_id, attendues):
    scopes = _clients(realm)[client_id]["defaultClientScopes"]
    assert {s.removeprefix("aud-") for s in scopes if s.startswith("aud-")} == attendues


def test_clients_publics_en_pkce_sans_mot_de_passe(realm):
    for client in realm["clients"]:
        if not client.get("publicClient") or client["clientId"] == "cfao-spa":
            continue
        assert client["attributes"]["pkce.code.challenge.method"] == "S256", client["clientId"]
        assert client["directAccessGrantsEnabled"] is False, client["clientId"]


def test_aucun_secret_litteral(realm):
    for client in realm["clients"]:
        if "secret" in client:
            assert SUBSTITUTION.match(client["secret"]), client["clientId"]


def test_spa_de_dev_desactivable(realm):
    assert SUBSTITUTION.match(str(_clients(realm)["cfao-spa"]["enabled"]))


def test_job_ci_realm_filtre_sur_ses_chemins():
    ci = (RACINE / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    filtres = ci.split("            realm:\n", 1)[1].split("\n    steps:", 1)[0] if "            realm:\n" in ci else ""
    for chemin in ("keycloak/**", "cerbos/policies/**", "cfao-core/identity/roles.py"):
        assert f"'{chemin}'" in filtres, chemin
    job = ci.split("\n  realm:\n", 1)[1].split("\n  core:\n", 1)[0]
    assert "needs.changes.outputs.realm == 'true'" in job
    assert "smoke_realm.py" in job and "SPA_ATTENDUE=disabled" in job
