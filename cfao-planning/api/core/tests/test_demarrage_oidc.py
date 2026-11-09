"""Démarrage refusé sans configuration OIDC (cause de la panne 401 du 06/11)."""
import os
import subprocess
import sys
from pathlib import Path

import pytest

API = Path(__file__).resolve().parents[2]
ISSUER = "https://cfao.example/auth/realms/cfao"
JWKS = "http://keycloak:8080/auth/realms/cfao/protocol/openid-connect/certs"


def _charger_reglages(**oidc: str) -> subprocess.CompletedProcess:
    env = {k: v for k, v in os.environ.items() if not k.startswith("OIDC_")}
    env.update(PLANNING_SECRET_KEY="cle-de-test", DJANGO_SETTINGS_MODULE="config.settings.dev",
               PYTHONIOENCODING="utf-8", **oidc)
    return subprocess.run(
        [sys.executable, "-c", "import config.settings.dev"],
        cwd=API, env=env, capture_output=True, text=True, encoding="utf-8", timeout=60,
    )


@pytest.mark.parametrize(
    "oidc, manquant",
    [
        ({}, "OIDC_AUDIENCE"),
        ({"OIDC_TRUSTED_ISSUERS": f"{ISSUER}={JWKS}"}, "OIDC_AUDIENCE"),
        ({"OIDC_AUDIENCE": "cfao-planning-api"}, "OIDC_TRUSTED_ISSUERS"),
        ({"OIDC_AUDIENCE": " , ", "OIDC_ISSUER": ISSUER}, "OIDC_TRUSTED_ISSUERS"),
    ],
)
def test_refuse_de_demarrer_sans_audience_ou_emetteur(oidc, manquant):
    res = _charger_reglages(**oidc)
    assert res.returncode != 0
    assert "ImproperlyConfigured" in res.stderr
    assert manquant in res.stderr


def test_entree_d_emetteur_invalide_refusee():
    res = _charger_reglages(OIDC_AUDIENCE="cfao-planning-api", OIDC_TRUSTED_ISSUERS="sans-egal")
    assert res.returncode != 0
    assert "ImproperlyConfigured" in res.stderr and "entrée invalide" in res.stderr


@pytest.mark.parametrize(
    "oidc",
    [
        {"OIDC_AUDIENCE": "cfao-planning-api", "OIDC_TRUSTED_ISSUERS": f"{ISSUER}={JWKS}"},
        {"OIDC_AUDIENCE": "cfao-planning-api", "OIDC_ISSUER": ISSUER, "OIDC_JWKS_URL": JWKS},
    ],
)
def test_demarre_avec_audience_et_emetteur(oidc):
    res = _charger_reglages(**oidc)
    assert res.returncode == 0, res.stderr
