"""Source du périmètre utilisateur — l'interface qui rend le module détachable.

Le JWT Keycloak dit **qui** agit et avec quels rôles. Il ne dit pas de façon fiable
**sur quoi** : le périmètre (filiale, marques) est une donnée métier.

Deux implémentations, choisies par `PLANNING_DEPLOYMENT_MODE` :

- `standalone` → `LocalIdentityProvider` : le périmètre vient de la table locale
  `referential.UserProfile`, alimentée par import.
- `integrated` → `PlatformIdentityProvider` : le périmètre vient du module `identity`
  de la plateforme (`GET /api/v1/core/me`), avec cache court.

C'est le seul endroit du module qui connaît cette différence. Aucun appel direct à
la plateforme ailleurs — c'est ce qui permet de basculer par variable
d'environnement plutôt que par modification de code (spec §2).
"""
from __future__ import annotations

from typing import Protocol

import requests
from django.conf import settings
from django.core.cache import cache

_CACHE_TTL = 60
_TIMEOUT = 5


class IdentityProvider(Protocol):
    def resolve(self, principal) -> None:
        """Complète `principal.roles` et `principal.attr` **en place**.

        Ne lève jamais : un périmètre non résolu laisse le principal tel qu'il sort
        du token. Comme les policies Cerbos sont en default-deny, un périmètre vide
        refuse l'accès — c'est le comportement voulu (fail-closed).
        """


class LocalIdentityProvider:
    """Mode standalone — périmètre lu dans la base du module."""

    def resolve(self, principal) -> None:
        from referential.models import UserProfile  # import tardif (cycle core↔referential)

        profile = (
            UserProfile.objects.filter(keycloak_sub=principal.id, is_active=True)
            .select_related("country")
            .prefetch_related("brands")
            .first()
        )
        if not profile:
            return
        principal.roles = profile.roles or principal.roles
        principal.attr["scopeNodes"] = profile.scope_nodes()
        principal.attr["brands"] = [b.code for b in profile.brands.all()]
        principal.attr["locale"] = profile.locale
        principal.attr["country"] = profile.country.code if profile.country else ""


class PlatformIdentityProvider:
    """Mode integrated — périmètre lu depuis le module `identity` de la plateforme."""

    def resolve(self, principal) -> None:
        key = f"planning:principal:{principal.id}"
        resolved = cache.get(key)
        if resolved is None:
            resolved = self._fetch(principal)
            if resolved is None:
                return
            cache.set(key, resolved, _CACHE_TTL)
        principal.roles = resolved.get("roles") or principal.roles
        principal.attr.update(resolved.get("attr") or {})

    def _fetch(self, principal) -> dict | None:
        url = f"{settings.PLATFORM_CORE_HTTP.rstrip('/')}/api/v1/core/me"
        try:
            resp = requests.get(
                url,
                headers={"Authorization": f"Bearer {principal.raw_token}"},
                timeout=_TIMEOUT,
            )
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError):
            return None


def get_identity_provider() -> IdentityProvider:
    if settings.DEPLOYMENT_MODE == "integrated":
        return PlatformIdentityProvider()
    return LocalIdentityProvider()
