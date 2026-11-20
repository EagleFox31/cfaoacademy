"""Réglages de développement."""
from .base import *  # noqa: F401,F403
from .base import OIDC_AUDIENCE
from .oidc_obligatoire import exiger_audience

exiger_audience(OIDC_AUDIENCE, "cfao-needs")

DEBUG = True
ALLOWED_HOSTS = ["*"]
