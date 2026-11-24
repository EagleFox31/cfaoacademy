"""Constat 12 : sans OIDC_AUDIENCE, démarrage refusé et jeton refusé (jamais d'`aud` non vérifiée)."""
import os
import subprocess
import sys
from pathlib import Path

import pytest
from rest_framework import exceptions
from rest_framework.test import APIRequestFactory

from core.auth import jwt_verifier
from core.auth.oidc import KeycloakJWTAuthentication

API = Path(__file__).resolve().parents[2]


def _charger_dev(**oidc_vars):
    env = {k: v for k, v in os.environ.items() if not k.startswith(("DJANGO_", "OIDC_"))}
    env.update(DJANGO_SETTINGS_MODULE="config.settings.dev", NEEDS_SECRET_KEY="x" * 50,
               PYTHONIOENCODING="utf-8", **oidc_vars)
    return subprocess.run([sys.executable, "-c", "import config.settings.dev"], cwd=API, env=env,
                          capture_output=True, encoding="utf-8", timeout=60)


@pytest.mark.parametrize("oidc_vars", [{}, {"OIDC_AUDIENCE": ""}, {"OIDC_AUDIENCE": " , "}])
def test_dev_refuse_de_demarrer_sans_audience(oidc_vars):
    r = _charger_dev(**oidc_vars)
    assert r.returncode != 0 and "OIDC_AUDIENCE" in r.stderr, r.stderr[-500:]


def test_dev_demarre_avec_audience():
    r = _charger_dev(OIDC_AUDIENCE="cfao-needs-api")
    assert r.returncode == 0, r.stderr[-500:]


@pytest.mark.parametrize("audience", ["", " , "])
def test_jeton_refuse_sans_audience_configuree(settings, monkeypatch, audience):
    settings.OIDC_AUDIENCE = audience
    appels = []
    monkeypatch.setattr(jwt_verifier, "verify", lambda *a, **k: appels.append(a) or {"sub": "u-1"})
    requete = APIRequestFactory().get("/", HTTP_AUTHORIZATION="Bearer jeton")
    with pytest.raises(exceptions.AuthenticationFailed):
        KeycloakJWTAuthentication().authenticate(requete)
    assert appels == []  # refusé avant toute vérification, donc avant d'ignorer `aud`
