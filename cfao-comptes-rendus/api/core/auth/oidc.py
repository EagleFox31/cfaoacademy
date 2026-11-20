"""Mode integre : validation du JWT Keycloak via JWKS (architecture.md §6).

Le jeton arrive en `Authorization: Bearer`, injecte par la passerelle
(oauth2-proxy) ; aucun mot de passe ne transite par ce service.
"""
from __future__ import annotations

import logging

from django.conf import settings
from rest_framework import authentication, exceptions

from . import jwt_verifier
from .identity import get_identity_provider
from .principal import construire_principal

journal = logging.getLogger(__name__)


def verifier_jeton(token: str) -> dict:
    """Les claims d'un jeton valide ; leve AuthenticationFailed sinon."""
    # L'audience est toujours verifiee : sans elle, un jeton emis par le
    # meme royaume pour une autre application serait accepte.
    audiences = jwt_verifier.audiences(settings.OIDC_AUDIENCE)
    if not audiences:
        raise exceptions.AuthenticationFailed("OIDC_AUDIENCE non configuree.")
    try:
        return jwt_verifier.verify(
            token,
            jwt_verifier.trusted_issuers(
                settings.OIDC_TRUSTED_ISSUERS, settings.OIDC_ISSUER, settings.OIDC_JWKS_URL),
            audiences,
        )
    except jwt_verifier.TokenRejected as exc:  # signature, expiration, audience, emetteur...
        journal.info("jeton refuse : %s", exc)
        raise exceptions.AuthenticationFailed("Jeton invalide.") from exc


class KeycloakJWTAuthentication(authentication.BaseAuthentication):
    """Authentifie via `Authorization: Bearer <JWT>` ; le perimetre vient de l'adaptateur."""

    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode("utf-8")
        if not header.startswith(self.keyword + " "):
            return None
        token = header[len(self.keyword) + 1:].strip()
        claims = verifier_jeton(token)
        resolu = get_identity_provider().resolve_user(user_id=claims["sub"], raw_token=token)
        return construire_principal({**resolu, "id": claims["sub"]}, claims), token

    def authenticate_header(self, request):
        return self.keyword
