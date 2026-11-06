"""Réglages de test — SQLite en mémoire, aucun appel réseau."""
import os

os.environ.setdefault("PLANNING_SECRET_KEY", "test-only-not-a-real-secret")

from .base import *  # noqa: E402,F401,F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
CERBOS_HTTP = "http://cerbos.invalid:3592"
