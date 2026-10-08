"""Tests : base SQLite en memoire, mode autonome, aucun service exterieur."""
import os

os.environ.setdefault("DEBUG", "True")
os.environ.setdefault("DEPLOYMENT_MODE", "standalone")

from .base import *  # noqa: E402,F401,F403

DEBUG = True
DEPLOYMENT_MODE = "standalone"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
CERBOS_HTTP = "http://cerbos.invalid:3592"
PLATFORM_CORE_URL = "http://core.invalid"
