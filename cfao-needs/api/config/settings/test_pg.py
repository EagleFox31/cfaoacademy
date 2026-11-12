"""Réglages de test sur Postgres : trigger de version des besoins, NOTIFY, snapshot."""
import os

from .test import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("NEEDS_TEST_PG_NAME", "needs_test"),
        "USER": os.environ.get("NEEDS_TEST_PG_USER", "postgres"),
        "PASSWORD": os.environ.get("NEEDS_TEST_PG_PASSWORD", "postgres"),
        "HOST": os.environ.get("NEEDS_TEST_PG_HOST", "localhost"),
        "PORT": os.environ.get("NEEDS_TEST_PG_PORT", "5432"),
    }
}
