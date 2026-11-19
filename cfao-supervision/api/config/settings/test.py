"""Réglages de test — SQLite en mémoire, aucun appel réseau."""
import os

os.environ.setdefault("SUPERVISION_SECRET_KEY", "test-only-not-a-real-secret")

from .base import *  # noqa: E402,F401,F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
CERBOS_HTTP = "http://cerbos.invalid:3592"
DOCKER_PROXY_URL = "http://docker.invalid:2375"
KEYCLOAK_INTERNAL_URL = "http://keycloak.invalid/auth"
KEYCLOAK_COLLECTOR_SECRET = "secret-de-test"
SUPERVISION_PROJECTS = ["cfao-needs", "cfao-edge"]
SUPERVISION_EDGE_CONTAINER = "cfao-edge-edge-1"
