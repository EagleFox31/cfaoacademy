"""Réglages communs cfao-core."""
from pathlib import Path
import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
)

SECRET_KEY = env("DJANGO_SECRET_KEY", default="dev-only-change-me")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["*"])

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "identity",
    "audit",
    "lms",
    # <generated-apps>  (ne pas retirer : ancre du générateur scripts/new_module.py)
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("CORE_DB_NAME", default="core"),
        "USER": env("CORE_DB_USER", default="core"),
        "PASSWORD": env("CORE_DB_PASSWORD", default="core"),
        "HOST": env("CORE_DB_HOST", default="localhost"),
        "PORT": env("CORE_DB_PORT", default="5432"),
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True

# ── REST framework : authN Keycloak + authZ Cerbos par défaut (default-deny) ──
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "core.auth.oidc.KeycloakJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "core.pagination.TimestampCursorPagination",
    "PAGE_SIZE": 25,
    "EXCEPTION_HANDLER": "core.exceptions.normalized_exception_handler",
}

# ── OIDC (Keycloak) ──
OIDC_JWKS_URL = env("OIDC_JWKS_URL", default="")
OIDC_ISSUER = env("OIDC_ISSUER", default="")
OIDC_AUDIENCE = env("OIDC_AUDIENCE", default="")

# ── Cerbos (PDP) ──
CERBOS_HTTP = env("CERBOS_HTTP", default="http://localhost:3592")
