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
DEMO = RACINE / "keycloak" / "config" / "dev" / "cfao-demo-users.yaml"
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


@pytest.mark.parametrize("client_id", ["cfao-portal", "cfao-needs-web"])
def test_hotes_des_clients_de_prod_fournis_par_l_environnement(realm, client_id):
    # Aucun hôte codé : la même image sert dev, LAN, zrok ou un futur domaine.
    client = _clients(realm)[client_id]
    assert SUBSTITUTION.match(client["redirectUris"]), client_id
    assert client["webOrigins"] == ["+"], client_id


def test_spa_de_dev_desactivable(realm):
    assert SUBSTITUTION.match(str(_clients(realm)["cfao-spa"]["enabled"]))


def test_realm_de_prod_sans_aucun_compte(realm):
    # Les comptes de démo (mot de passe « demo ») ne doivent jamais atteindre la prod.
    assert "users" not in realm
    assert "credentials" not in REALM.read_text(encoding="utf-8")


def test_comptes_de_demo_isoles_dans_dev(realm):
    demo = yaml.safe_load(DEMO.read_text(encoding="utf-8"))
    for u in demo["users"]:
        assert set(u["realmRoles"]) <= _roles_realm(realm), u["username"]
    assert demo["realm"] == "cfao"
    assert set(demo) == {"realm", "users"}, "dev/ ne porte que des comptes"
    # Le glob de prod (/config/*.yaml) ne descend pas dans dev/.
    assert DEMO.parent != REALM.parent


def test_import_dev_seulement_par_defaut_du_compose_racine():
    compose = (RACINE / "docker-compose.yml").read_text(encoding="utf-8")
    assert "IMPORT_FILES_LOCATIONS: ${KC_IMPORT_LOCATIONS:-/config/*.yaml,/config/dev/*.yaml}" in compose


def test_image_de_prod_sans_les_comptes_de_demo():
    # Le contexte de build n'admet que config/*.yaml : dev/ reste hors de l'image.
    ignore = (RACINE / "keycloak" / ".dockerignore").read_text(encoding="utf-8").split()
    assert ignore[0] == "*" and "!config/*.yaml" in ignore
    assert not [r for r in ignore if "dev" in r]
    dockerfile = (RACINE / "keycloak" / "Dockerfile").read_text(encoding="utf-8")
    assert "COPY config/*.yaml /opt/cfao-realm/" in dockerfile
    assert 'CMD ["start", "--optimized"]' in dockerfile


def test_compose_de_prod_sans_secret_par_defaut():
    prod = yaml.safe_load((RACINE / "keycloak" / "compose.prod.yml").read_text(encoding="utf-8"))
    services = prod["services"]
    for nom, cle in (("keycloak-db", "POSTGRES_PASSWORD"), ("keycloak", "KC_DB_PASSWORD"),
                     ("keycloak", "KC_BOOTSTRAP_ADMIN_PASSWORD"), ("keycloak", "KC_HOSTNAME"),
                     ("keycloak", "KC_HOSTNAME_ADMIN"), ("config","KEYCLOAK_PASSWORD"), ("config", "CFAO_PORTAL_SECRET"),
                     ("config", "CFAO_PORTAL_REDIRECT_URIS"), ("config", "CFAO_NEEDS_REDIRECT_URIS")):
        assert re.fullmatch(r"\$\{[A-Z_]+:\?.+\}", services[nom]["environment"][cle]), f"{nom}.{cle}"
    # Émetteur canonique, chemin réseau des modules libre.
    assert services["keycloak"]["environment"]["KC_HOSTNAME_BACKCHANNEL_DYNAMIC"] == "true"
    # Pas de `command` : le CMD de l'image (start --optimized), jamais start-dev.
    assert "command" not in services["keycloak"]
    assert services["config"]["environment"]["CFAO_SPA_ENABLED"] == "false"
    assert services["config"]["environment"]["IMPORT_FILES_LOCATIONS"].endswith(":-/opt/cfao-realm/*.yaml}")
    assert services["keycloak"]["image"] == services["config"]["image"]


def test_image_servie_sous_auth():
    # Keycloak calcule ses URL depuis le chemin reçu : il est servi sous le même
    # chemin que son URL publique, aucun proxy ne retire le préfixe.
    dockerfile = (RACINE / "keycloak" / "Dockerfile").read_text(encoding="utf-8")
    etages = dockerfile.split("\nFROM ")
    for etage in (etages[2], etages[3]):  # builder, puis image finale
        assert "KC_HTTP_RELATIVE_PATH=/auth" in etage
        assert "KC_HTTP_MANAGEMENT_RELATIVE_PATH=/" in etage  # healthcheck 9000/health/ready
    prod = yaml.safe_load((RACINE / "keycloak" / "compose.prod.yml").read_text(encoding="utf-8"))
    assert prod["services"]["config"]["environment"]["KEYCLOAK_URL"].endswith("/auth")
    # Keycloak n'écoute qu'en local par défaut : seule la passerelle le publie.
    assert prod["services"]["keycloak"]["ports"][0].startswith("${KC_BIND:-127.0.0.1}:")
    exemple = (RACINE / "keycloak" / ".env.prod.example").read_text(encoding="utf-8")
    assert re.search(r"^KC_HOSTNAME=https://\S+/auth$", exemple, re.M)


def test_job_ci_realm_filtre_sur_ses_chemins():
    ci = (RACINE / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    filtres = ci.split("            realm:\n", 1)[1].split("\n    steps:", 1)[0] if "            realm:\n" in ci else ""
    for chemin in ("keycloak/**", "cerbos/policies/**", "cfao-core/identity/roles.py"):
        assert f"'{chemin}'" in filtres, chemin
    job = ci.split("\n  realm:\n", 1)[1].split("\n  edge:\n", 1)[0]
    assert "needs.changes.outputs.realm == 'true'" in job
    assert "smoke_realm.py" in job and "SPA_ATTENDUE=disabled" in job
    assert "DEMO_ATTENDUE=absente" in job and "--force-recreate keycloak" in job
    assert "smoke_migration.py" in job
    assert "-f keycloak/compose.prod.yml" in job and "docker build" in job
