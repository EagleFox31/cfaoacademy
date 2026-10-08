"""Le mode integre refuse de demarrer avec une configuration de dev.

Chaque cas charge la configuration dans un processus a part : elle est
lue une seule fois par processus.
"""
import os
import subprocess
import sys
from pathlib import Path

import pytest

API = Path(__file__).resolve().parents[2]
INTEGRE = {"DEPLOYMENT_MODE": "integrated", "SECRET_KEY": "une-vraie-cle",
           "OIDC_ISSUER": "http://keycloak/realms/cfao",
           "OIDC_JWKS_URL": "http://keycloak/realms/cfao/protocol/openid-connect/certs"}


def charger(**variables):
    env = {k: v for k, v in os.environ.items()
           if k not in ("DEPLOYMENT_MODE", "SECRET_KEY", "OIDC_ISSUER", "OIDC_JWKS_URL",
                        "DEBUG", "ALLOWED_HOSTS")}
    env.update(variables, DJANGO_SETTINGS_MODULE="config.settings.base")
    return subprocess.run([sys.executable, "-c", "from django.conf import settings; print(settings.ALLOWED_HOSTS)"],
                          cwd=API, env=env, capture_output=True, text=True)


def test_le_mode_integre_complet_demarre():
    r = charger(**INTEGRE)
    assert r.returncode == 0, r.stderr
    assert r.stdout.strip() == "['localhost', '127.0.0.1']"


@pytest.mark.parametrize("manquant", ["SECRET_KEY", "OIDC_ISSUER", "OIDC_JWKS_URL"])
def test_le_mode_integre_exige_cle_et_emetteur(manquant):
    # Vide plutot qu'absente : un `.env` local ne la remplit pas.
    r = charger(**{**INTEGRE, manquant: ""})
    assert r.returncode != 0
    assert manquant in r.stderr


def test_le_mode_integre_refuse_la_cle_de_dev():
    r = charger(**{**INTEGRE, "SECRET_KEY": "cle-de-dev-non-secrete"})
    assert r.returncode != 0
    assert "SECRET_KEY" in r.stderr


def test_le_mode_autonome_exige_debug():
    r = charger(DEPLOYMENT_MODE="standalone", DEBUG="False")
    assert r.returncode != 0
    assert "DEBUG=True" in r.stderr
