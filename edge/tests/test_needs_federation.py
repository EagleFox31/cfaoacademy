"""needs sur le Keycloak commun (L6), vérifié sans docker : plus de Keycloak de
module, émetteur fixé au déploiement, redirections exactes."""
import json
import re
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parents[2]
NEEDS = RACINE / "cfao-needs"


def _texte(chemin):
    return Path(chemin).read_text(encoding="utf-8")


def _prod():
    return yaml.safe_load(_texte(NEEDS / "docker-compose.prod.yml"))


def test_prod_sans_keycloak_de_module():
    prod = _prod()
    assert not {"needs-keycloak", "needs-kc-db"} & set(prod["services"])
    assert "needs-kc-db-data" not in prod["volumes"]
    texte = _texte(NEEDS / "docker-compose.prod.yml")
    assert "needs-keycloak" not in texte and "/realms/cfao-needs" not in texte


def test_prod_sur_l_emetteur_commun():
    services = _prod()["services"]
    api = services["needs-api"]["environment"]
    # Émetteur jamais déduit de l'hôte : absent, le déploiement s'arrête.
    assert re.fullmatch(r"\$\{OIDC_ISSUER:\?.+\}", api["OIDC_ISSUER"])
    assert api["OIDC_AUDIENCE"] == "${OIDC_AUDIENCE:-cfao-needs-api}"
    assert api["OIDC_JWKS_URL"].endswith(":-http://keycloak:8080/auth/realms/cfao/protocol/openid-connect/certs}")
    assert services["needs-worker"]["environment"] == api
    # Les clés se lisent sur le réseau du Keycloak commun, créé par son projet.
    assert set(services["needs-api"]["networks"]) == {"default", "identite"}
    reseau = _prod()["networks"]["identite"]
    assert reseau["external"] is True and reseau["name"] == "${IDENTITY_NETWORK:-cfao-identity_default}"


def test_modele_env_laisse_l_audience_au_compose():
    # Compose lit .env d'office : une audience fixée ici écrase le défaut de la prod.
    exemple = _texte(NEEDS / ".env.example")
    assert re.search(r"^OIDC_AUDIENCE=$", exemple, re.M)


def test_passerelle_prod_derriere_cfao_edge():
    passerelle = _prod()["services"]["needs-gateway"]
    assert passerelle["environment"]["NEEDS_OIDC_ISSUER"].startswith("${OIDC_ISSUER:?")
    assert passerelle["environment"]["NEEDS_OIDC_CLIENT_ID"] == "${NEEDS_OIDC_CLIENT_ID:-cfao-needs-web}"
    assert passerelle["ports"] == ["${NEEDS_BIND:-127.0.0.1}:${NEEDS_PORT:-8082}:80"]


def test_passerelle_ne_relaie_plus_keycloak():
    conf = _texte(NEEDS / "gateway" / "nginx.conf")
    locations = re.findall(r"^\s*location\s+(?:[=~^*]+\s+)?(\S+)\s*\{", conf, re.M)
    assert sorted(locations) == sorted(["/config.js", "/api/v1/needs/", "/catalogues/", "/"])
    assert "needs-keycloak" not in conf and "/realms/" not in conf
    assert re.search(r"location = /config\.js \{\s*alias /etc/nginx/needs-config\.js;", conf)


def test_image_ecrit_la_config_au_demarrage():
    dockerfile = _texte(NEEDS / "gateway" / "Dockerfile")
    assert "COPY --chmod=755 gateway/entrypoint.d/15-config-oidc.sh /docker-entrypoint.d/" in dockerfile
    script = (NEEDS / "gateway" / "entrypoint.d" / "15-config-oidc.sh").read_bytes()
    assert script.startswith(b"#!/bin/sh\n") and b"\r" not in script
    assert b"> /etc/nginx/needs-config.js" in script


def test_spa_lit_la_config_avant_l_application():
    index = _texte(NEEDS / "web" / "index.html")
    assert index.index('<script src="/config.js"></script>') < index.index('type="module"')
    auth = _texte(NEEDS / "web" / "src" / "lib" / "auth.js")
    assert "if (RUNTIME.oidcIssuer) return RUNTIME.oidcIssuer" in auth
    assert "`${window.location.origin}/auth/realms/cfao`" in auth
    assert "RUNTIME.oidcClientId || import.meta.env.VITE_OIDC_CLIENT_ID || 'cfao-needs-web'" in auth
    assert "/realms/cfao-needs`" not in auth


def test_redirections_needs_exactes_dans_le_modele_de_prod():
    exemple = _texte(RACINE / "keycloak" / ".env.prod.example")
    valeur = re.search(r"^CFAO_NEEDS_REDIRECT_URIS=(.+)$", exemple, re.M).group(1)
    uris = json.loads(valeur)
    assert uris and not [u for u in uris if "*" in u]
    origines = {re.match(r"^https?://[^/]+", u).group(0) for u in uris}
    # Par entrée : le rappel, et la racine pour le retour de déconnexion.
    assert sorted(uris) == sorted(f"{o}{c}" for o in origines for c in ("/callback", "/"))


def test_dev_autonome_sans_relais_par_la_passerelle():
    dev = yaml.safe_load(_texte(NEEDS / "docker-compose.yml"))["services"]
    kc_direct = "http://localhost:${KC_PORT:-8081}"
    assert dev["needs-keycloak"]["environment"]["KC_HOSTNAME"] == kc_direct
    assert dev["needs-api"]["environment"]["OIDC_ISSUER"] == f"${{OIDC_ISSUER:-{kc_direct}/realms/cfao-needs}}"
    assert dev["needs-gateway"]["environment"]["NEEDS_OIDC_ISSUER"] == dev["needs-api"]["environment"]["OIDC_ISSUER"]
