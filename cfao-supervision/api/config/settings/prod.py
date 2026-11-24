"""Réglages de production : ceux d'exécution (contrôle OIDC au démarrage compris),
sans le mode débogage ni l'acceptation de tout hôte."""
from .base import env
from .dev import *  # noqa: F401,F403

DEBUG = False
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1", "supervision-api"])
