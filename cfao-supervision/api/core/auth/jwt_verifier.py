"""Vérification commune des jetons Keycloak, sans Django.

Fichier de référence : `cfao-core/core/auth/jwt_verifier.py`. Chaque module en
garde une copie identique dans son `core/auth/` (modules détachables, pas
d'import croisé) ; la CI refuse toute copie divergente.

Émetteurs : correspondance exacte, jamais de suffixe ni de réécriture d'hôte.
Un même realm vu par deux hôtes (navigateur et réseau Docker) se déclare comme
deux émetteurs, chacun avec l'URL JWKS joignable depuis le service :

    OIDC_TRUSTED_ISSUERS="http://localhost:8080/realms/cfao=http://keycloak:8080/realms/cfao/protocol/openid-connect/certs"

`OIDC_ISSUER` + `OIDC_JWKS_URL` restent acceptés : ils forment une entrée de plus.
Audiences : `OIDC_AUDIENCE`, liste séparée par des virgules ; le jeton doit en
porter au moins une.
"""
from __future__ import annotations

from collections.abc import Mapping, Sequence

import jwt

ALGORITHMS = ("RS256",)

_clients: dict[str, jwt.PyJWKClient] = {}


class TokenRejected(Exception):
    """Jeton refusé ; le message sert au journal, jamais à la réponse HTTP."""


def trusted_issuers(raw: str = "", issuer: str = "", jwks_url: str = "") -> dict[str, str]:
    """Émetteur exact -> URL JWKS, depuis `OIDC_TRUSTED_ISSUERS` et le couple historique."""
    issuers: dict[str, str] = {}
    for entry in (raw or "").replace("\n", ";").split(";"):
        entry = entry.strip()
        if not entry:
            continue
        iss, sep, url = entry.partition("=")
        if not sep or not iss.strip() or not url.strip():
            raise ValueError(f"OIDC_TRUSTED_ISSUERS : entrée invalide « {entry} » (attendu émetteur=jwks).")
        issuers[iss.strip()] = url.strip()
    if issuer and jwks_url:
        issuers.setdefault(issuer, jwks_url)
    return issuers


def audiences(raw: str = "") -> tuple[str, ...]:
    return tuple(a.strip() for a in (raw or "").split(",") if a.strip())


def _client(jwks_url: str) -> jwt.PyJWKClient:
    if jwks_url not in _clients:
        _clients[jwks_url] = jwt.PyJWKClient(jwks_url)
    return _clients[jwks_url]


def verify(
    token: str,
    issuers: Mapping[str, str],
    accepted_audiences: Sequence[str] = (),
    algorithms: Sequence[str] = ALGORITHMS,
) -> dict:
    """Les claims d'un jeton valide ; lève TokenRejected sinon.

    Sans audience configurée, `aud` n'est pas vérifiée : à réserver aux modules
    qui n'ont pas encore leur client Keycloak dédié.
    """
    if not issuers:
        raise TokenRejected("aucun émetteur de confiance configuré")
    try:
        header = jwt.get_unverified_header(token)
        if header.get("alg") not in algorithms:
            raise TokenRejected(f"algorithme refusé : {header.get('alg')!r}")
        iss = jwt.decode(token, options={"verify_signature": False}).get("iss")
        if not isinstance(iss, str) or iss not in issuers:
            raise TokenRejected(f"émetteur inconnu : {iss!r}")
        key = _client(issuers[iss]).get_signing_key_from_jwt(token).key
        require = ["exp", "sub", "iss"] + (["aud"] if accepted_audiences else [])
        return jwt.decode(
            token,
            key,
            algorithms=list(algorithms),
            issuer=iss,
            audience=list(accepted_audiences) or None,
            options={"require": require, "verify_aud": bool(accepted_audiences)},
        )
    except TokenRejected:
        raise
    except (jwt.PyJWTError, ValueError, TypeError, KeyError) as exc:
        raise TokenRejected(f"{type(exc).__name__}: {exc}") from exc
