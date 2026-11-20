"""Réglages de test sur Postgres, pour les scénarios d'écritures concurrentes."""
import os

from .test import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("PLANNING_TEST_PG_NAME", "planning_test"),
        "USER": os.environ.get("PLANNING_TEST_PG_USER", "postgres"),
        "PASSWORD": os.environ.get("PLANNING_TEST_PG_PASSWORD", "postgres"),
        "HOST": os.environ.get("PLANNING_TEST_PG_HOST", "localhost"),
        "PORT": os.environ.get("PLANNING_TEST_PG_PORT", "5432"),
    }
}
