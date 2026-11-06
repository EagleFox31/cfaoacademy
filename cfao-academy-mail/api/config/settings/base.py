"""Réglages communs — service mail inter-modules (détachable)."""
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(DJANGO_DEBUG=(bool, False))

SECRET_KEY = env("MAIL_SECRET_KEY")
DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["*"])
DEPLOYMENT_MODE = env("DEPLOYMENT_MODE", default="standalone")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "django_q",
    "core",
    "outbound",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("MAIL_DB_NAME", default="cfao_mail"),
        "USER": env("MAIL_DB_USER", default="cfao_mail"),
        "PASSWORD": env("MAIL_DB_PASSWORD", default=""),
        "HOST": env("MAIL_DB_HOST", default="localhost"),
        "PORT": env("MAIL_DB_PORT", default="5432"),
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
LANGUAGE_CODE = "fr"

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "UNAUTHENTICATED_USER": None,
}

MAIL_INBOUND_KEY = env("MAIL_INBOUND_KEY", default="")
ACADEMY_INTERNAL_DOMAINS = env.list("MAIL_INTERNAL_DOMAINS", default=["cfao.com"])
ACADEMY_TEAM_RECIPIENTS = env.list("MAIL_TEAM_RECIPIENTS", default=[])

# Relais interne CFAO (Academix). Pas de Reply-To global : chaque producteur
# le fournit par message (`reply_to` ou `context.reply_to`).
EMAIL_BACKEND_KIND = env("MAIL_EMAIL_BACKEND", default="smtp")
EMAIL_FROM = env("MAIL_EMAIL_FROM", default="CFAO Academy <helpdeskcm@cfao.com>")
EMAIL_SUBJECT_PREFIX = env("MAIL_EMAIL_SUBJECT_PREFIX", default="[CFAO Academy]")
SMTP_HOST = env("MAIL_SMTP_HOST", default="smtp.cfao.corp")
SMTP_PORT = env.int("MAIL_SMTP_PORT", default=25)
SMTP_USERNAME = env("MAIL_SMTP_USERNAME", default="")
SMTP_PASSWORD = env("MAIL_SMTP_PASSWORD", default="")
SMTP_USE_TLS = env.bool("MAIL_SMTP_USE_TLS", default=False)
SMTP_TIMEOUT = env.int("MAIL_SMTP_TIMEOUT", default=15)

# URL publique de la plateforme (calculée par deploy.ps1 si absente) : son hôte est
# toujours autorisé dans module_url, et http n'est admis que pour cette origine exacte.
PUBLIC_BASE_URL = env("MAIL_PUBLIC_BASE_URL", default="")
# Hôtes supplémentaires (autres producteurs). Les deux vides = tout lien refusé hors DEBUG.
MAIL_ALLOWED_LINK_HOSTS = env.list("MAIL_ALLOWED_LINK_HOSTS", default=[])

Q_CLUSTER = {
    "name": "mail",
    "workers": 2,
    "timeout": 120,
    "retry": 180,
    "queue_limit": 50,
    "orm": "default",
    "catch_up": False,
    "poll": 2,
    "guard_cycle": 5,
}
