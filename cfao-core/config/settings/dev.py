"""Réglages de développement."""
from .base import INSTALLED_APPS, MIDDLEWARE  # noqa: F401
from .base import *  # noqa: F401,F403

DEBUG = True
ALLOWED_HOSTS = ["*"]

# ── CORS (dev uniquement) ────────────────────────────────────────────────
# En prod, le BFF (oauth2-proxy + nginx) sert le portail et l'API depuis la
# même origine → pas de CORS. En dev, Vite tourne sur :5173 et l'API sur
# :8000 : on autorise explicitement l'origine du dev-server. Ne PAS mettre
# CORS_ALLOW_ALL_ORIGINS ni exposer ça en prod.
INSTALLED_APPS = [*INSTALLED_APPS, "corsheaders"]
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # doit être en tête, avant CommonMiddleware
    *MIDDLEWARE,
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
CORS_ALLOW_CREDENTIALS = True
