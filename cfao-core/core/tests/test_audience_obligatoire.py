"""Constat 12 : sans OIDC_AUDIENCE, démarrage refusé et jeton refusé (jamais d'`aud` non vérifiée)."""
import os
import subprocess
import sys
from pathlib import Path

import pytest
from rest_framework import exceptions

from core.auth import jwt_verifier, oidc

RACINE = Path(__file__).resolve().parents[2]


def _charger_dev(**oidc_vars):
    env = {k: v for k, v in os.environ.items() if not k.startswith(("DJANGO_", "OIDC_"))}
    env.update(DJANGO_SETTINGS_MODULE="config.settings.dev", PYTHONIOENCODING="utf-8", **oidc_vars)
    return subprocess.run([sys.executable, "-c", "import config.settings.dev"], cwd=RACINE, env=env,
                          capture_output=True, encoding="utf-8", timeout=60)


@pytest.mark.parametrize("oidc_vars", [{}, {"OIDC_AUDIENCE": ""}, {"OIDC_AUDIENCE": " , "}])
def test_dev_refuse_de_demarrer_sans_audience(oidc_vars):
    r = _charger_dev(**oidc_vars)
    assert r.returncode != 0 and "OIDC_AUDIENCE" in r.stderr, r.stderr[-500:]


def test_dev_demarre_avec_audience():
    r = _charger_dev(OIDC_AUDIENCE="cfao-core-api")
    assert r.returncode == 0, r.stderr[-500:]


@pytest.mark.parametrize("audience", ["", " , "])
def test_jeton_refuse_sans_audience_configuree(settings, monkeypatch, audience):
    settings.OIDC_AUDIENCE = audience
    appels = []
    monkeypatch.setattr(jwt_verifier, "verify", lambda *a, **k: appels.append(a) or {"sub": "u-1"})
    with pytest.raises(exceptions.AuthenticationFailed):
        oidc.verify_token("jeton")
    assert appels == []  # refusé avant toute vérification, donc avant d'ignorer `aud`


def test_jeton_verifie_avec_l_audience_configuree(settings, monkeypatch):
    settings.OIDC_AUDIENCE = "cfao-core-api"
    recu = {}
    monkeypatch.setattr(jwt_verifier, "verify", lambda token, issuers, aud: recu.update(aud=aud) or {"sub": "u-1"})
    assert oidc.verify_token("jeton") == {"sub": "u-1"}
    assert recu["aud"] == ("cfao-core-api",)
