import os

# Avant l'import de base : prod reste en échec si MAIL_SECRET_KEY manque,
# les tests d'un clone propre non.
os.environ.setdefault("MAIL_SECRET_KEY", "test-secret-key")

from .base import *  # noqa: F403

SECRET_KEY = "test-secret-key"
MAIL_INBOUND_KEY = "test-inbound-key"
DEBUG = False
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}
EMAIL_BACKEND_KIND = "locmem"
MAIL_ALLOWED_LINK_HOSTS = ["academy.example", "cr.example", "cr.filiale.example"]
Q_CLUSTER = {**Q_CLUSTER, "sync": True}
