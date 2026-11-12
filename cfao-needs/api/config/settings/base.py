"""Réglages communs cfao-needs (app 16 — Identification des Besoins en Formations).

Module **détachable** : en mode `standalone` il parle à son propre Keycloak et à son
propre Cerbos ; en mode `integrated` il pointe ceux de la plateforme. Le basculement
se fait par variables d'environnement, jamais par modification de code
(docs/SPEC_RECUEIL_BESOINS_2027.md §2).
"""
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
)

# ── Interdit n° 3 : aucun secret par défaut en dur ─────────────────────────────
# Academix expédiait une SECRET_KEY littérale dans son code : quiconque lisait le
# dépôt pouvait forger un jeton Super Admin (docs/AUDIT_ACADEMIX.md §4).
# Ici le démarrage ÉCHOUE si le secret n'est pas fourni par l'environnement.
SECRET_KEY = env("NEEDS_SECRET_KEY")

DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["*"])

# Mode de déploiement : "standalone" (Keycloak + Cerbos embarqués) ou "integrated".
DEPLOYMENT_MODE = env("NEEDS_DEPLOYMENT_MODE", default="standalone")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "django_q",
    "core",
    "referential",
    "campaigns",
    "outbound",
    "analytics",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# API JSON uniquement — pas d'UI browsable DRF (évite TemplateDoesNotExist
# quand un navigateur demande text/html).
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
        "NAME": env("NEEDS_DB_NAME", default="needs"),
        "USER": env("NEEDS_DB_USER", default="needs"),
        "PASSWORD": env("NEEDS_DB_PASSWORD", default="needs"),
        "HOST": env("NEEDS_DB_HOST", default="localhost"),
        "PORT": env("NEEDS_DB_PORT", default="5432"),
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
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
CERBOS_HTTP = env("CERBOS_HTTP", default="http://needs-cerbos:3592")

# ── CORS : interdit n° 5 — jamais "*" ────────────────────────────────────────
# La liste est explicite. Academix déclarait allow_origins=["*"] avec
# allow_credentials=True, ce qui annulait sa propre liste blanche.
CORS_ALLOWED_ORIGINS = env.list("NEEDS_CORS_ORIGINS", default=[])

# ── Imports tabulaires (docs/PATRON_IMPORT_TABULAIRE.md §5) ──────────────────
IMPORT_MAX_FILE_MB = env.int("NEEDS_IMPORT_MAX_FILE_MB", default=10)
IMPORT_MAX_ROWS = env.int("NEEDS_IMPORT_MAX_ROWS", default=5000)

# ── Emailing — circuit à validation (spec §7) ────────────────────────────────
# Domaines considérés comme INTERNES à l'équipe Academy. Un type de message
# configuré en envoi automatique vers un destinataire hors de ces domaines fait
# échouer le démarrage (outbound.apps.OutboundConfig.ready → interdit n° 11).
ACADEMY_INTERNAL_DOMAINS = env.list("NEEDS_INTERNAL_DOMAINS", default=["cfao.com"])
ACADEMY_TEAM_RECIPIENTS = env.list("NEEDS_TEAM_RECIPIENTS", default=[])

EMAIL_BACKEND_KIND = env("NEEDS_EMAIL_BACKEND", default="console")  # console | smtp
EMAIL_FROM = env("NEEDS_EMAIL_FROM", default="CFAO Academy <no-reply@cfao.com>")
EMAIL_SUBJECT_PREFIX = env("NEEDS_EMAIL_SUBJECT_PREFIX", default="[CFAO Academy]")
SMTP_HOST = env("NEEDS_SMTP_HOST", default="")
SMTP_PORT = env.int("NEEDS_SMTP_PORT", default=25)
SMTP_USE_TLS = env.bool("NEEDS_SMTP_USE_TLS", default=False)

# Regroupement du résumé interne après N minutes d'inactivité sur la fiche (spec §7.5).
SUMMARY_DEBOUNCE_MINUTES = env.int("NEEDS_SUMMARY_DEBOUNCE_MINUTES", default=30)
# Alerte quand une fiche attend la relecture depuis plus de N heures (story 16-19).
REVIEW_SLA_HOURS = env.int("NEEDS_REVIEW_SLA_HOURS", default=48)

# Lien profond vers une fiche, utilisé dans les emails internes.
PUBLIC_BASE_URL = env("NEEDS_PUBLIC_BASE_URL", default="http://localhost:8080")

# ── Analytics inbound (service-to-service) ─────────────────────────────────────
# Shared key attendue en header `X-Analytics-Key` sur /api/v1/needs/analytics/*.
# Utilisée par cfao-core pour agréger les KPIs du dashboard super admin.
# Absente = tous les endpoints analytics renvoient 401 (fail-close).
ANALYTICS_INBOUND_KEY = env("NEEDS_ANALYTICS_INBOUND_KEY", default="")
CATALOG_WRITE_INBOUND_KEY = env("NEEDS_CATALOG_WRITE_INBOUND_KEY", default="")

# ── Copie des besoins poussée à cfao-planning (relais `needs-relay`) ──────────
# URL ou clé absente = relais inactif ; planning se rattrape par /analytics/snapshot.
PLANNING_API_URL = env("PLANNING_API_URL", default="")
NEEDS_SNAPSHOT_PUSH_KEY = env("NEEDS_SNAPSHOT_PUSH_KEY", default="")
NEEDS_RELAY_LISTEN_TIMEOUT_S = env.int("NEEDS_RELAY_LISTEN_TIMEOUT_S", default=30)
NEEDS_RELAY_MAX_BACKOFF_S = env.int("NEEDS_RELAY_MAX_BACKOFF_S", default=600)

# ── Worker asynchrone : broker = Postgres, pas de Redis (architecture.md §7) ──
Q_CLUSTER = {
    "name": "needs",
    "workers": 2,
    "timeout": 120,
    "retry": 180,
    "queue_limit": 50,
    "orm": "default",
    "catch_up": False,
    # Deux cadences distinctes, et c'est la seconde qui coute :
    #   - `poll`        : le courtier interroge la file (defaut 0,2 s)
    #   - `guard_cycle` : le sentinelle verifie la sante des workers (defaut 0,5 s)
    # Mesure : `poll: 2` seul n'a rien change (~5 % de CPU a vide) — le bruit venait
    # du sentinelle. Pour de l'envoi d'emails, ces deux cadences peuvent etre lentes.
    "poll": 2,
    "guard_cycle": 5,
}
