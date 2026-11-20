"""Réglages de production (constat 16) : DEBUG coupé, clé et hôtes obligatoires, `*` refusé."""
import os
import subprocess
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parents[2]
LIRE = ("import django; django.setup(); from django.conf import settings as s; "
        "print(s.DEBUG, ','.join(s.ALLOWED_HOSTS), s.SECRET_KEY == 'dev-only-change-me')")


def _demarrer(**variables):
    env = {k: v for k, v in os.environ.items() if not k.startswith(("DJANGO_", "CORE_"))}
    env.update(DJANGO_SETTINGS_MODULE="config.settings.prod", **variables)
    return subprocess.run([sys.executable, "-c", LIRE], cwd=RACINE, env=env,
                          capture_output=True, encoding="utf-8", timeout=60)


def test_prod_coupe_debug_et_garde_cle_et_hotes():
    r = _demarrer(DJANGO_SECRET_KEY="x" * 50, DJANGO_ALLOWED_HOSTS="academy.exemple,core-api", DJANGO_DEBUG="True")
    assert r.returncode == 0, r.stderr[-500:]
    assert r.stdout.strip() == "False academy.exemple,core-api False"


def test_prod_refuse_de_demarrer_sans_cle():
    r = _demarrer(DJANGO_ALLOWED_HOSTS="academy.exemple")
    assert r.returncode != 0 and "DJANGO_SECRET_KEY" in r.stderr, r.stderr[-500:]


@pytest.mark.parametrize("hotes", [None, "", "*", "academy.exemple,*"])
def test_prod_refuse_de_demarrer_sans_hotes_explicites(hotes):
    r = _demarrer(DJANGO_SECRET_KEY="x" * 50, **({} if hotes is None else {"DJANGO_ALLOWED_HOSTS": hotes}))
    assert r.returncode != 0 and "DJANGO_ALLOWED_HOSTS" in r.stderr, r.stderr[-500:]
