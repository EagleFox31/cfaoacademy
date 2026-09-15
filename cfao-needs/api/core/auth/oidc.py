"""Validation du JWT Keycloak via JWKS.

Reprend le patron de `cfao-core` (architecture.md §6) avec une seule différence :
la résolution du périmètre passe par `IdentityProvider` (identity.py), qui a deux
implémentations selon le mode de déploiement.

**Interdit n° 7 de l'audit** : un seul chemin d'authentification, un seul code
d'erreur. Academix avait deux `get_current_user` divergents — l'un renvoyait 401,
l'autre 403 puis **404 sur compte inconnu**, ce qui permettait d'énumérer les
comptes. Ici toute cause d'échec produit un 401 indifférencié.
"""
from __future__ import annotations

import jwt
from django.conf import settings
from rest_framework import authentication, exceptions

from .identity import get_identity_provider
from .principal import build_principal

_jwk_client: jwt.PyJWKClient | None = None


def _client() -> jwt.PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        if not settings.OIDC_JWKS_URL:
            raise exceptions.AuthenticationFailed("Authentification indisponible.")
        _jwk_client = jwt.PyJWKClient(settings.OIDC_JWKS_URL)
    return _jwk_client


class KeycloakJWTAuthentication(authentication.BaseAuthentication):
    """Authentifie via `Authorization: Bearer <JWT>` ; ne fixe jamais de scope lui-même."""

    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode("utf-8")
        if not header.startswith(self.keyword + " "):
            return None
        token = header[len(self.keyword) + 1 :].strip()

        options = {"require": ["exp", "sub"]}
        audience = settings.OIDC_AUDIENCE or None
        if audience is None:
            options["verify_aud"] = False

        try:
            signing_key = _client().get_signing_key_from_jwt(token)
            unverified_claims = jwt.decode(token, options={"verify_signature": False})
            token_iss = unverified_claims.get("iss", "")
            if not (token_iss.endswith("/realms/cfao-needs") or (settings.OIDC_ISSUER and token_iss == settings.OIDC_ISSUER)):
                raise jwt.InvalidIssuerError("Invalid issuer")

            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=audience,
                issuer=token_iss,
                options=options,
            )
        except jwt.PyJWTError:
            # Message volontairement uniforme : signature, expiration, audience ou
            # émetteur invalides produisent la même réponse. Rien ne doit permettre
            # de distinguer « jeton mal formé » de « compte inconnu ».
            raise exceptions.AuthenticationFailed("Authentification refusée.")

        principal = build_principal(claims)
        principal.raw_token = token
        get_identity_provider().resolve(principal)
        return principal, token

    def authenticate_header(self, request):
        return self.keyword
