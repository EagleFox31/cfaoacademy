"""Réglages d'exécution (compose : poste, recette et prod).

Le service ne démarre pas sans audience ni émetteur de confiance : sans eux,
chaque appel finit en 401 alors que le conteneur paraît sain (panne du 06/11).
pytest utilise `config.settings.test` et n'est pas concerné.
"""
from django.core.exceptions import ImproperlyConfigured

from core.auth.jwt_verifier import audiences, trusted_issuers

from .base import *  # noqa: F401,F403
from .base import OIDC_AUDIENCE, OIDC_ISSUER, OIDC_JWKS_URL, OIDC_TRUSTED_ISSUERS

DEBUG = True
ALLOWED_HOSTS = ["*"]


def _oidc_manquants() -> list[str]:
    manquants = []
    if not audiences(OIDC_AUDIENCE):
        manquants.append("OIDC_AUDIENCE")
    try:
        if not trusted_issuers(OIDC_TRUSTED_ISSUERS, OIDC_ISSUER, OIDC_JWKS_URL):
            manquants.append("OIDC_TRUSTED_ISSUERS (ou OIDC_ISSUER + OIDC_JWKS_URL)")
    except ValueError as exc:
        raise ImproperlyConfigured(str(exc)) from exc
    return manquants


if _manquants := _oidc_manquants():
    raise ImproperlyConfigured(
        "cfao-planning refuse de démarrer, variables vides : " + ", ".join(_manquants)
    )
