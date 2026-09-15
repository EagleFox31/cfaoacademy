"""Validation du JWT Keycloak via JWKS (architecture.md §6)."""
from __future__ import annotations

import jwt
from django.conf import settings
from rest_framework import authentication, exceptions

from .principal import build_principal

_jwk_client: jwt.PyJWKClient | None = None


def _client() -> jwt.PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        if not settings.OIDC_JWKS_URL:
            raise exceptions.AuthenticationFailed("OIDC_JWKS_URL non configuré.")
        _jwk_client = jwt.PyJWKClient(settings.OIDC_JWKS_URL)
    return _jwk_client


class KeycloakJWTAuthentication(authentication.BaseAuthentication):
    """Authentifie via `Authorization: Bearer <JWT>`; ne fixe jamais de scope lui-même."""

    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode("utf-8")
        if not header.startswith(self.keyword + " "):
            return None
        token = header[len(self.keyword) + 1:].strip()

        options = {"require": ["exp", "sub"], "verify_iss": False}
        audience = settings.OIDC_AUDIENCE or None
        if audience is None:
            options["verify_aud"] = False

        try:
            signing_key = _client().get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=audience,
                options=options,
            )
            if settings.OIDC_ISSUER:
                token_iss = claims.get("iss", "")
                norm_token = token_iss.replace("keycloak:8080", "localhost:8080")
                norm_expected = settings.OIDC_ISSUER.replace("keycloak:8080", "localhost:8080")
                if norm_token != norm_expected:
                    raise jwt.InvalidIssuerError(f"Issuer mismatch: {token_iss} != {settings.OIDC_ISSUER}")
        except jwt.PyJWTError as exc:  # signature, expiration, audience, issuer…
            raise exceptions.AuthenticationFailed(f"Jeton invalide : {exc}")

        principal = build_principal(claims)
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
