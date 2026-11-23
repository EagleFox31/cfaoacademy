"""Réglages de production (constat 1) : DEBUG coupé, hôtes listés, `*` refusé au démarrage."""
import os
import subprocess
import sys
from pathlib import Path

import pytest

API = Path(__file__).resolve().parents[2]
LIRE = ("import django; django.setup(); from django.conf import settings as s; "
        "print(s.DEBUG, ','.join(s.ALLOWED_HOSTS))")


def _demarrer(**variables):
    env = {k: v for k, v in os.environ.items() if not k.startswith(("DJANGO_", "NEEDS_", "OIDC_"))}
    env.update({"DJANGO_SETTINGS_MODULE": "config.settings.prod", "NEEDS_SECRET_KEY": "x" * 50,
                "OIDC_AUDIENCE": "cfao-needs-api", "PYTHONIOENCODING": "utf-8", **variables})
    # Sortie forcée en UTF-8 : sous Windows, l'erreur accentuée arriverait en cp1252.
    return subprocess.run([sys.executable, "-c", LIRE], cwd=API, env=env, capture_output=True,
                          encoding="utf-8", errors="replace", timeout=60)


def test_prod_coupe_debug_et_garde_les_hotes_listes():
    r = _demarrer(DJANGO_ALLOWED_HOSTS="academy.exemple,needs-api", DJANGO_DEBUG="True")
    assert r.returncode == 0, r.stderr[-500:]
    assert r.stdout.strip() == "False academy.exemple,needs-api"


@pytest.mark.parametrize("hotes", [None, "", "*", "academy.exemple,*"])
def test_prod_refuse_de_demarrer_sans_hotes_explicites(hotes):
    r = _demarrer(**({} if hotes is None else {"DJANGO_ALLOWED_HOSTS": hotes}))
    assert r.returncode != 0 and "DJANGO_ALLOWED_HOSTS" in r.stderr, r.stderr[-500:]


@pytest.mark.parametrize("audience", ["", " , "])
def test_prod_refuse_de_demarrer_sans_audience(audience):
    r = _demarrer(DJANGO_ALLOWED_HOSTS="academy.exemple", OIDC_AUDIENCE=audience)
    assert r.returncode != 0 and "OIDC_AUDIENCE" in r.stderr, r.stderr[-500:]
