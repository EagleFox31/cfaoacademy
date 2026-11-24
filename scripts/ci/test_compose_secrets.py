"""Tests de la garde des secrets : exemples refusés et acceptés, puis le dépôt réel."""
import pytest

from compose_secrets import check, composes_de_prod, est_secret, main


@pytest.mark.parametrize("ligne", [
    "      DB_PASSWORD: ${DB_PASSWORD:-change-me}",
    "      DB_PASSWORD: ${DB_PASSWORD-change-me}",
    "      - DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY:-dev}",
    "      API_TOKEN: ${API_TOKEN:-}",
    "      POSTGRES_PASSWORD: needs",
    "      - POSTGRES_PASSWORD=needs",
    '      CODE_PEPPER: "abc"',
])
def test_refuse(ligne):
    assert check(ligne), ligne


@pytest.mark.parametrize("ligne", [
    "      DB_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD manquant}",
    "      - DB_PASSWORD=${DB_PASSWORD:?}",
    "      NEEDS_CATALOG_WRITE_KEY: ${NEEDS_CATALOG_WRITE_KEY:-}",
    "      EDGE_KEYCLOAK_UPSTREAM: ${EDGE_KEYCLOAK_UPSTREAM:-}",
    "      POSTGRES_PASSWORD_FILE: /run/secrets/db",
    "      LOG_LEVEL: ${LOG_LEVEL:-info}",
    "      # DB_PASSWORD: ${DB_PASSWORD:-ancien}",
    '      DB_PASSWORD: ""',
])
def test_accepte(ligne):
    assert check(ligne) == [], ligne


def test_nom_decoupe_sur_les_mots():
    assert est_secret("NEEDS_ANALYTICS_KEY")
    assert not est_secret("EDGE_KEYCLOAK_UPSTREAM")
    assert not est_secret("MONKEY_ISLAND")


def test_le_depot_est_couvert_et_conforme():
    noms = {p.as_posix().rsplit("/", 2)[-2] for p in composes_de_prod()}
    assert {"cfao-needs", "cfao-planning", "keycloak", "edge"} <= noms
    assert main() == 0
