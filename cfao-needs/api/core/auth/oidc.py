"""Validation du JWT Keycloak via JWKS.

Reprend le patron de `cfao-core` (architecture.md §6) avec une seule différence :
la résolution du périmètre passe par `IdentityProvider` (identity.py), qui a deux
implémentations selon le mode de déploiement. La vérification elle-même est la
copie commune `jwt_verifier.py` (émetteurs exacts, audiences listées).

**Interdit n° 7 de l'audit** : un seul chemin d'authentification, un seul code
d'erreur. Academix avait deux `get_current_user` divergents — l'un renvoyait 401,
l'autre 403 puis **404 sur compte inconnu**, ce qui permettait d'énumérer les
comptes. Ici toute cause d'échec produit un 401 indifférencié.
"""
from __future__ import annotations

import logging

from django.conf import settings
from rest_framework import authentication, exceptions

from . import jwt_verifier
from .identity import EN_TETE_VU_COMME, VuCommeRefuse, get_identity_provider
from .principal import build_principal

logger = logging.getLogger(__name__)
audit = logging.getLogger("needs.audit")

LECTURES = frozenset({"GET", "HEAD"})


class KeycloakJWTAuthentication(authentication.BaseAuthentication):
    """Authentifie via `Authorization: Bearer <JWT>` ; ne fixe jamais de scope lui-même."""

    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode("utf-8")
        if not header.startswith(self.keyword + " "):
            return None
        token = header[len(self.keyword) + 1 :].strip()

        audiences = jwt_verifier.audiences(settings.OIDC_AUDIENCE)
        if not audiences:  # sans audience, `aud` ne serait pas vérifiée (constat 12)
            logger.error("JWT refusé : OIDC_AUDIENCE non configurée.")
            raise exceptions.AuthenticationFailed("Authentification refusée.")
        try:
            claims = jwt_verifier.verify(
                token,
                jwt_verifier.trusted_issuers(
                    settings.OIDC_TRUSTED_ISSUERS, settings.OIDC_ISSUER, settings.OIDC_JWKS_URL
                ),
                audiences,
            )
        except jwt_verifier.TokenRejected as exc:
            logger.info("JWT refusé : %s", exc)
            raise exceptions.AuthenticationFailed("Authentification refusée.")

        principal = build_principal(claims)
        principal.raw_token = token
        vu_comme = request.headers.get(EN_TETE_VU_COMME, "").strip() or None
        if vu_comme and request.method not in LECTURES:
            raise exceptions.PermissionDenied("vu_comme_lecture_seule")
        try:
            get_identity_provider().resolve(principal, vu_comme)
        except VuCommeRefuse as exc:
            audit.info("apercu.vu_comme refuse statut=%s vu_par=%s cible=%s %s %s",
                       exc.statut, claims.get("sub"), vu_comme, request.method, request.path)
            if exc.statut == 404:
                raise exceptions.NotFound("vu_comme_cible_introuvable")
            if exc.statut == 503:
                raise exceptions.APIException("vu_comme_indisponible")  # 500 → jamais de repli
            raise exceptions.PermissionDenied("vu_comme_refuse")
        if vu_comme:
            # Ni jeton ni donnée personnelle : des identifiants techniques seulement.
            audit.info("apercu.vu_comme vu_par=%s cible=%s %s %s",
                       principal.attr.get("vu_par"), vu_comme, request.method, request.path)
        return principal, token

    def authenticate_header(self, request):
        return self.keyword
