"""Validation du JWT Keycloak via JWKS (architecture.md §6)."""
from __future__ import annotations

import logging

from django.conf import settings
from rest_framework import authentication, exceptions

from . import jwt_verifier
from .principal import build_principal

logger = logging.getLogger(__name__)


def verify_token(token: str) -> dict:
    """Les claims d'un jeton valide ; lève AuthenticationFailed sinon (401 unique)."""
    try:
        return jwt_verifier.verify(
            token,
            jwt_verifier.trusted_issuers(
                settings.OIDC_TRUSTED_ISSUERS, settings.OIDC_ISSUER, settings.OIDC_JWKS_URL
            ),
            jwt_verifier.audiences(settings.OIDC_AUDIENCE),
        )
    except jwt_verifier.TokenRejected as exc:
        logger.info("JWT refusé : %s", exc)
        raise exceptions.AuthenticationFailed("Jeton invalide.") from exc


class KeycloakJWTAuthentication(authentication.BaseAuthentication):
    """Authentifie via `Authorization: Bearer <JWT>`; ne fixe jamais de scope lui-même."""

    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode("utf-8")
        if not header.startswith(self.keyword + " "):
            return None
        token = header[len(self.keyword) + 1:].strip()

        principal = build_principal(verify_token(token))
        _apply_db_scope(principal)  # périmètre = source de vérité identity (si compte connu)
        return principal, token

    def authenticate_header(self, request):
        return self.keyword


def _apply_db_scope(principal):
    """Résout le périmètre côté service (DB) : rôles + scopeNodes multi-affectations.
    Si le compte n'est pas (encore) en base, on garde les claims du token."""
    from identity.models import User  # import tardif (évite le cycle core↔identity)
    from identity.services import resolve_principal

    user = User.objects.filter(keycloak_sub=principal.id).first()
    if not user:
        return
    resolved = resolve_principal(user)
    principal.roles = resolved["roles"]
    principal.attr["scopeNodes"] = resolved["attr"]["scopeNodes"]
    principal.attr["departments"] = resolved["attr"]["departments"]
    principal.attr["brands"] = resolved["attr"]["brands"]
