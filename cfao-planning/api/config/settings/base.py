"""Réglages communs cfao-planning (app 05 — Planning des formateurs).

Module **détachable** : en mode `standalone` il parle à son propre Keycloak et à son
propre Cerbos ; en mode `integrated` il pointe ceux de la plateforme. Le basculement
se fait par variables d'environnement, jamais par modification de code
(docs/SPEC_PLANNING_FORMATEURS.md §2).
"""
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
)

# Aucun secret par défaut en dur : le démarrage ÉCHOUE si l'environnement ne le
# fournit pas (docs/AUDIT_ACADEMIX.md §4).
SECRET_KEY = env("PLANNING_SECRET_KEY")

DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["*"])

# "standalone" (Keycloak + Cerbos embarqués) ou "integrated" (plateforme).
DEPLOYMENT_MODE = env("PLANNING_DEPLOYMENT_MODE", default="standalone")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "core",
    "referential",
    "planning",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    }
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("PLANNING_DB_NAME", default="planning"),
        "USER": env("PLANNING_DB_USER", default="planning"),
        "PASSWORD": env("PLANNING_DB_PASSWORD", default="planning"),
        "HOST": env("PLANNING_DB_HOST", default="localhost"),
        "PORT": env("PLANNING_DB_PORT", default="5432"),
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
TIME_ZONE = "Africa/Douala"
LANGUAGE_CODE = "fr"

# ── REST framework : authN Keycloak + authZ Cerbos par défaut (default-deny) ──
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "core.auth.oidc.KeycloakJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PAGINATION_CLASS": "core.pagination.TimestampCursorPagination",
    "PAGE_SIZE": 50,
    "EXCEPTION_HANDLER": "core.exceptions.normalized_exception_handler",
}

# ── OIDC (Keycloak) ──
OIDC_JWKS_URL = env("OIDC_JWKS_URL", default="")
OIDC_ISSUER = env("OIDC_ISSUER", default="")
OIDC_AUDIENCE = env("OIDC_AUDIENCE", default="")
# Émetteurs supplémentaires « émetteur=jwks;… » (voir core/auth/jwt_verifier.py).
OIDC_TRUSTED_ISSUERS = env("OIDC_TRUSTED_ISSUERS", default="")

# ── Cerbos (PDP) ──
CERBOS_HTTP = env("CERBOS_HTTP", default="http://planning-cerbos:3592")

# ── cfao-needs (contrat needs-analytics) : besoins et thématiques non choisies ──
NEEDS_API_URL = env("NEEDS_API_URL", default="")
NEEDS_ANALYTICS_KEY = env("NEEDS_ANALYTICS_KEY", default="")
NEEDS_CATALOG_WRITE_KEY = env("NEEDS_CATALOG_WRITE_KEY", default="")
# Copie des besoins : poussée par cfao-needs (clé `X-Needs-Snapshot-Key`, absente =
# push refusé), revérifiée au plus toutes les RECHECK secondes par GET conditionnel.
NEEDS_SNAPSHOT_INBOUND_KEY = env("NEEDS_SNAPSHOT_INBOUND_KEY", default="")
NEEDS_SNAPSHOT_RECHECK_S = env.int("NEEDS_SNAPSHOT_RECHECK_S", default=300)
NEEDS_SNAPSHOT_TIMEOUT_S = env.float("NEEDS_SNAPSHOT_TIMEOUT_S", default=2.0)
NEEDS_SNAPSHOT_BACKGROUND = True  # revérification hors requête quand une copie existe

# ── Plateforme (mode integrated uniquement) ──
PLATFORM_CORE_HTTP = env("PLATFORM_CORE_HTTP", default="")

CORS_ALLOWED_ORIGINS = env.list("PLANNING_CORS_ORIGINS", default=[])

# ── Imports tabulaires (docs/PATRON_IMPORT_TABULAIRE.md §5) ──────────────────
IMPORT_MAX_FILE_MB = env.int("PLANNING_IMPORT_MAX_FILE_MB", default=10)
IMPORT_MAX_ROWS = env.int("PLANNING_IMPORT_MAX_ROWS", default=5000)

# Alerte « session sans formateur » à moins de N jours du début.
UNASSIGNED_ALERT_DAYS = env.int("PLANNING_UNASSIGNED_ALERT_DAYS", default=30)
# Site de l'Academy : une session y a lieu si son lieu le nomme, ou, sans lieu,
# si elle se tient dans ce pays. Sert à la clé de répartition (SPEC §8).
ACADEMY_SITE = env("PLANNING_ACADEMY_SITE", default="DOUALA")
ACADEMY_COUNTRY_CODE = env("PLANNING_ACADEMY_COUNTRY", default="cmr")
