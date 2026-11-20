"""Réglages de production : ceux de base, sans débogage, avec une liste d'hôtes explicite.

Un hôte non listé reçoit 400 (en-tête Host forgé). `*` et une liste vide refusent le démarrage.
"""
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])
if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS doit lister les hôtes servis (jamais « * »).")
# Origines HTTPS autorisées pour les requêtes à cookie (ex. https://<ip>:<port>) ; vide par défaut.
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])
