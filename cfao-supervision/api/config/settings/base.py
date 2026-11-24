"""Réglages communs cfao-supervision (cockpit d'exploitation de la plateforme).

Le module lit l'état des autres modules ; il n'agit sur aucun. Deux processus sur la
même image : l'API (lecture, jeton Keycloak + Cerbos) et le collecteur
(`manage.py collect`), seul à parler au proxy Docker et à l'API d'administration
Keycloak.
"""
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(DJANGO_DEBUG=(bool, False))

# Aucun secret par défaut : le démarrage échoue si l'environnement ne le fournit pas.
SECRET_KEY = env("SUPERVISION_SECRET_KEY")

DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["*"])

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "core",
    "supervision",
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
        "NAME": env("SUPERVISION_DB_NAME", default="supervision"),
        "USER": env("SUPERVISION_DB_USER", default="supervision"),
        "PASSWORD": env("SUPERVISION_DB_PASSWORD", default="supervision"),
        "HOST": env("SUPERVISION_DB_HOST", default="localhost"),
        "PORT": env("SUPERVISION_DB_PORT", default="5432"),
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
TIME_ZONE = "Africa/Douala"
LANGUAGE_CODE = "fr"

# ── REST framework : authN Keycloak + authZ Cerbos (default-deny) ──
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["core.auth.oidc.KeycloakJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "EXCEPTION_HANDLER": "core.exceptions.normalized_exception_handler",
    "UNAUTHENTICATED_USER": None,
}

# ── OIDC (Keycloak) ──
OIDC_JWKS_URL = env("OIDC_JWKS_URL", default="")
OIDC_ISSUER = env("OIDC_ISSUER", default="")
OIDC_AUDIENCE = env("OIDC_AUDIENCE", default="")
OIDC_TRUSTED_ISSUERS = env("OIDC_TRUSTED_ISSUERS", default="")

# ── Cerbos (PDP unique de la plateforme) ──
CERBOS_HTTP = env("CERBOS_HTTP", default="http://cerbos:3592")

# ── Collecteur ──
# Projets compose surveillés (liste blanche, seule source). Tout le reste de la
# machine est ignoré.
SUPERVISION_PROJECTS = env.list("SUPERVISION_PROJECTS", default=[])
# Espaces de registre des images de la plateforme : seules elles donnent la version
# d'un module (une image postgres ou cerbos n'en dit rien).
SUPERVISION_IMAGE_NAMESPACES = env.list("SUPERVISION_IMAGE_NAMESPACES", default=["antifragile237/"])
DOCKER_PROXY_URL = env("DOCKER_PROXY_URL", default="http://supervision-socket:2375")
# Seul conteneur dont les journaux sont lus (accès des utilisateurs par module).
SUPERVISION_EDGE_CONTAINER = env("SUPERVISION_EDGE_CONTAINER", default="")
DOCKER_INTERVAL_S = env.int("SUPERVISION_DOCKER_INTERVAL_S", default=15)
EDGE_INTERVAL_S = env.int("SUPERVISION_EDGE_INTERVAL_S", default=30)
KEYCLOAK_INTERVAL_S = env.int("SUPERVISION_KEYCLOAK_INTERVAL_S", default=60)

# Journal des connexions Keycloak (compte de service, droit view-events seul).
KEYCLOAK_INTERNAL_URL = env("KEYCLOAK_INTERNAL_URL", default="")  # ex. http://keycloak:8080/auth
KEYCLOAK_REALM = env("KEYCLOAK_REALM", default="cfao")
KEYCLOAK_COLLECTOR_CLIENT_ID = env("KEYCLOAK_COLLECTOR_CLIENT_ID", default="cfao-supervision-collector")
KEYCLOAK_COLLECTOR_SECRET = env("KEYCLOAK_COLLECTOR_SECRET", default="")

# Rétention (RGPD) : une connexion nominative est oubliée après N jours sans activité.
ACCESS_RETENTION_DAYS = env.int("SUPERVISION_ACCESS_RETENTION_DAYS", default=90)
EVENT_RETENTION_DAYS = env.int("SUPERVISION_EVENT_RETENTION_DAYS", default=180)
# Connexions refusées par le pare-feu du serveur (journal ufw monté en lecture seule).
# Vide = source désactivée (recette sans ufw). Monter le DOSSIER, pas le fichier :
# la rotation renomme le fichier et un montage de fichier garderait l'ancien.
UFW_LOG_PATH = env("SUPERVISION_UFW_LOG_PATH", default="")
UFW_INTERVAL_S = env.int("SUPERVISION_UFW_INTERVAL_S", default=30)
# Adresses IP des postes : oubliées après 7 jours.
REFUSED_RETENTION_DAYS = env.int("SUPERVISION_REFUSED_RETENTION_DAYS", default=7)
# Alerte : au moins N refus pour une adresse (ou un /24) sur la dernière fenêtre.
REFUSED_ALERT_THRESHOLD = env.int("SUPERVISION_REFUSED_ALERT_THRESHOLD", default=10)
REFUSED_ALERT_WINDOW_MIN = env.int("SUPERVISION_REFUSED_ALERT_WINDOW_MIN", default=60)
# Journal de Caddy (poignées TLS ratées, redirections), copié par rsyslog comme ufw.
# Vide = source désactivée. Même rétention que les refus du pare-feu.
CADDY_LOG_PATH = env("SUPERVISION_CADDY_LOG_PATH", default="")
CADDY_INTERVAL_S = env.int("SUPERVISION_CADDY_INTERVAL_S", default=30)
# Alerte : N certificats refusés par un poste sur la fenêtre, sans arrivée depuis.
CERT_ALERT_THRESHOLD = env.int("SUPERVISION_CERT_ALERT_THRESHOLD", default=3)
# Redirigé puis rien pendant ce délai : le poste n'est pas arrivé.
REDIRECT_GRACE_S = env.int("SUPERVISION_REDIRECT_GRACE_S", default=120)
# Sondes des adresses publiques, depuis le serveur : « url|fragment du titre » ou
# « url|-> adresse de redirection », séparées par « ; ». Vide = source désactivée.
PROBES = env("SUPERVISION_PROBES", default="")
PROBE_INTERVAL_S = env.int("SUPERVISION_PROBE_INTERVAL_S", default=60)
PROBE_TIMEOUT_S = env.int("SUPERVISION_PROBE_TIMEOUT_S", default=5)
# Alerte après N échecs consécutifs (un seul échec peut être un redémarrage).
PROBE_ALERT_AFTER = env.int("SUPERVISION_PROBE_ALERT_AFTER", default=2)
# Au-delà, l'écran signale que la surveillance ne remonte plus.
STALE_AFTER_S = env.int("SUPERVISION_STALE_AFTER_S", default=90)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
