"""Tests de la garde AGENTS.md section 7 : fixtures negatives, puis le depot reel."""
from pathlib import Path
import textwrap

import pytest

from compose_bootstrap import check, main

CONFORME = """
services:
  app-db:
    image: postgres:16-alpine
  app-migrate:
    build: ./api
    restart: "no"
    command: [python, manage.py, bootstrap]
    environment: {APP_DB_HOST: app-db}
    depends_on:
      app-db: {condition: service_healthy}
  app-api:
    build: ./api
    environment: {APP_DB_HOST: app-db}
    depends_on:
      app-db: {condition: service_healthy}
      app-migrate: {condition: service_completed_successfully}
  app-worker:
    build: ./api
    command: [python, manage.py, qcluster]
    depends_on:
      app-migrate: {condition: service_completed_successfully}
"""


def ecrire(tmp_path: Path, contenu: str, nom: str = "docker-compose.yml", dockerfile: str = "") -> Path:
    (tmp_path / "api").mkdir(exist_ok=True)
    (tmp_path / "api" / "Dockerfile").write_text(
        dockerfile or 'FROM python:3.12\nCMD ["gunicorn", "config.wsgi"]\n', encoding="utf-8"
    )
    path = tmp_path / nom
    path.write_text(textwrap.dedent(contenu), encoding="utf-8")
    return path


def test_compose_conforme(tmp_path):
    assert check(ecrire(tmp_path, CONFORME)) == []


def test_consommateur_sans_job(tmp_path):
    erreurs = check(ecrire(tmp_path, """
        services:
          app-db: {image: postgres:16-alpine}
          app-api:
            build: ./api
            depends_on: [app-db]
    """))
    assert any("app-api consomme une base" in e for e in erreurs)


def test_detection_par_variable_d_environnement(tmp_path):
    erreurs = check(ecrire(tmp_path, """
        services:
          rapports:
            build: ./api
            environment:
              - DATABASE_URL=sqlite:////donnees/db.sqlite3
    """))
    assert any("rapports consomme une base" in e for e in erreurs)


def test_attente_sans_condition(tmp_path):
    contenu = CONFORME.replace(
        "app-migrate: {condition: service_completed_successfully}\n  app-worker",
        "app-migrate: {condition: service_started}\n  app-worker",
    )
    erreurs = check(ecrire(tmp_path, contenu))
    assert any("app-api consomme une base" in e for e in erreurs)


def test_job_d_une_autre_image(tmp_path):
    contenu = CONFORME.replace(
        "app-migrate:\n    build: ./api", "app-migrate:\n    image: autre/image:v1"
    )
    erreurs = check(ecrire(tmp_path, contenu))
    assert any("app-api consomme une base" in e for e in erreurs)


@pytest.mark.parametrize("ligne, attendu", [
    ('    restart: "no"\n', 'restart: "no"'),
    ('    restart: "no"\n    profiles: [migrate]\n', "profiles"),
    ('    restart: "no"\n    ports: ["8000:8000"]\n', "ports"),
])
def test_job_non_ponctuel(tmp_path, ligne, attendu):
    remplacement = "" if attendu.startswith("restart") else ligne
    contenu = CONFORME.replace('    restart: "no"\n', remplacement, 1)
    erreurs = check(ecrire(tmp_path, contenu))
    assert any("app-migrate" in e and attendu in e for e in erreurs)


def test_restart_no_non_quote_est_refuse(tmp_path):
    # YAML 1.1 : `restart: no` vaut le booleen False, pas la chaine attendue par compose.
    contenu = CONFORME.replace('restart: "no"', "restart: no")
    assert any('restart: "no"' in e for e in check(ecrire(tmp_path, contenu)))


def test_migration_dans_la_commande_du_service(tmp_path):
    contenu = CONFORME.replace(
        "command: [python, manage.py, qcluster]",
        'command: sh -c "python manage.py migrate && python manage.py qcluster"',
    )
    erreurs = check(ecrire(tmp_path, contenu))
    assert any("app-worker migre ou seede dans son command" in e for e in erreurs)


def test_migration_dans_le_cmd_du_dockerfile(tmp_path):
    dockerfile = (
        "FROM python:3.12 AS base\nCMD [\"true\"]\nFROM base\n"
        'CMD ["sh", "-c", "python manage.py migrate --noinput && \\\n  exec gunicorn x"]\n'
    )
    erreurs = check(ecrire(tmp_path, CONFORME, dockerfile=dockerfile))
    assert any("app-api migre ou seede dans son CMD du Dockerfile" in e for e in erreurs)


def test_command_du_compose_remplace_le_cmd(tmp_path):
    dockerfile = 'FROM python:3.12\nCMD ["sh", "-c", "python manage.py migrate && gunicorn x"]\n'
    contenu = CONFORME.replace(
        "    environment: {APP_DB_HOST: app-db}\n    depends_on:\n      app-db: {condition: service_healthy}\n      app-migrate",
        "    command: [gunicorn, x]\n    environment: {APP_DB_HOST: app-db}\n    depends_on:\n      app-db: {condition: service_healthy}\n      app-migrate",
    )
    erreurs = check(ecrire(tmp_path, contenu, dockerfile=dockerfile))
    assert not any("app-api" in e for e in erreurs)


def test_demo_interdite_en_prod(tmp_path):
    contenu = CONFORME.replace("[python, manage.py, bootstrap]", "[python, manage.py, bootstrap, --demo]")
    assert check(ecrire(tmp_path, contenu)) == []
    erreurs = check(ecrire(tmp_path, contenu, nom="docker-compose.prod.yml"))
    assert any("app-migrate lance des donnees de demo en prod" in e for e in erreurs)


def test_service_en_liste_blanche(tmp_path):
    erreurs = check(ecrire(tmp_path, """
        services:
          keycloak-db: {image: postgres:16-alpine}
          keycloak:
            image: quay.io/keycloak/keycloak:26.5.5
            environment: {KC_DB_URL: "jdbc:postgresql://keycloak-db/keycloak"}
            depends_on: [keycloak-db]
    """))
    assert erreurs == []


def test_override_voisin_fusionne(tmp_path):
    ecrire(tmp_path, CONFORME)
    (tmp_path / "docker-compose.override.yml").write_text(
        "services:\n  app-api:\n    command: python manage.py migrate\n", encoding="utf-8"
    )
    erreurs = check(tmp_path / "docker-compose.yml")
    assert any("app-api migre ou seede dans son command" in e for e in erreurs)


def test_depot_reel_conforme(capsys):
    code = main([])
    assert code == 0, capsys.readouterr().out
