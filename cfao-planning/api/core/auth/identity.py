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


#: Aperçu « vu comme » : le super admin lit le portail d'un compte réel. La décision
#: (droit, cible active, audit) est prise par core sur GET /api/v1/core/me ; planning ne
#: fait que transmettre l'en-tête par ce seul chemin et refuser toute écriture.
EN_TETE_VU_COMME = "X-Cfao-Vu-Comme"


class VuCommeRefuse(Exception):
    """Aperçu refusé ou cible introuvable : jamais de repli sur l'identité réelle."""

    def __init__(self, statut: int):
        super().__init__(statut)
        self.statut = statut


class IdentityProvider(Protocol):
    def resolve(self, principal, vu_comme: str | None = None) -> None:
        """Complète `principal.roles` et `principal.attr` **en place**.

        Ne lève jamais sans `vu_comme` : un périmètre non résolu laisse le principal
        tel qu'il sort du token. Comme les policies Cerbos sont en default-deny, un
        périmètre vide refuse l'accès — c'est le comportement voulu (fail-closed).
        Avec `vu_comme`, tout échec lève `VuCommeRefuse`.
        """


class LocalIdentityProvider:
    """Mode standalone — périmètre lu dans la base du module."""

    def resolve(self, principal, vu_comme: str | None = None) -> None:
        if vu_comme:  # l'aperçu n'existe qu'avec la plateforme (core décide)
            raise VuCommeRefuse(403)
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

    def resolve(self, principal, vu_comme: str | None = None) -> None:
        if vu_comme:
            self._resolve_vu_comme(principal, vu_comme)
            return
        key = f"planning:principal:{principal.id}"
        resolved = cache.get(key)
        if resolved is None:
            resolved = self._fetch(principal)
            if resolved is None:
                return
            cache.set(key, resolved, _CACHE_TTL)
        principal.roles = resolved.get("roles") or principal.roles
        principal.attr.update(resolved.get("attr") or {})

    def _resolve_vu_comme(self, principal, cible: str) -> None:
        # Clé = compte réel + cible : une réponse « vu comme » ne sert jamais une
        # requête normale, ni un autre appelant.
        key = f"planning:apercu:{principal.id}:{cible}"
        resolved = cache.get(key)
        if resolved is None:
            resolved = self._fetch_vu_comme(principal, cible)
            cache.set(key, resolved, _CACHE_TTL)
        vu_par = principal.id
        principal.id = resolved.get("id") or principal.id
        principal.roles = resolved.get("roles") or []
        principal.attr = {**(resolved.get("attr") or {}), "apercu": True, "vu_par": vu_par}

    def _fetch_vu_comme(self, principal, cible: str) -> dict:
        try:
            resp = self._get_me(principal, {EN_TETE_VU_COMME: cible})
        except requests.RequestException:
            raise VuCommeRefuse(503)
        if resp.status_code == 404:
            raise VuCommeRefuse(404)
        if resp.status_code != 200:
            raise VuCommeRefuse(403)
        try:
            data = resp.json()
        except ValueError:
            raise VuCommeRefuse(503)
        if not (data.get("attr") or {}).get("apercu"):  # core n'a pas appliqué l'aperçu
            raise VuCommeRefuse(403)
        return data

    def _get_me(self, principal, extra: dict | None = None):
        url = f"{settings.PLATFORM_CORE_HTTP.rstrip('/')}/api/v1/core/me"
        return requests.get(
            url,
            headers={"Authorization": f"Bearer {principal.raw_token}", **(extra or {})},
            timeout=_TIMEOUT,
        )

    def _fetch(self, principal) -> dict | None:
        try:
            resp = self._get_me(principal)
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError):
            return None


def get_identity_provider() -> IdentityProvider:
    if settings.DEPLOYMENT_MODE == "integrated":
        return PlatformIdentityProvider()
    return LocalIdentityProvider()
