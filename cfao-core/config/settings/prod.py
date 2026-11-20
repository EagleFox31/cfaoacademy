"""Réglages de production : ceux de base, sans débogage, clé et hôtes obligatoires.

Pas de clé par défaut ici (celle de base n'est faite que pour le poste de dev).
`*` et une liste d'hôtes vide refusent le démarrage.
SECURE_SSL_REDIRECT et HSTS restent hors de Django : TLS est terminé par Caddy, et
needs, planning et le healthcheck appellent core-api en HTTP interne (une redirection
les casserait). Aucune session ni cookie Django (jetons Bearer) : rien à marquer Secure.
"""
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import OIDC_AUDIENCE, env
from .oidc_obligatoire import exiger_audience

exiger_audience(OIDC_AUDIENCE, "cfao-core")

DEBUG = False
SECRET_KEY = env("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])
if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS doit lister les hôtes servis (jamais « * »).")
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])
