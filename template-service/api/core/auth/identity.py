"""Interface d'identité et de périmètre (Pattern Adapter).

Deux modes gérés par DEPLOYMENT_MODE :
- 'standalone' : lit un profil mock local pour développer sans dépendances.
- 'integrated' : interroge l'API centrale de CFAO Academy (GET /api/v1/core/me) avec cache.
"""
from typing import Protocol, Dict, Any
import requests
from django.conf import settings
from django.core.cache import cache

class IdentityProvider(Protocol):
    def resolve_user(self, user_id: str, raw_token: str = "") -> Dict[str, Any]:
        """Retourne le dictionnaire des rôles et attributs du périmètre utilisateur."""
        ...

class LocalMockIdentityProvider:
    """Mode autonome pour tests locaux."""
    def resolve_user(self, user_id: str, raw_token: str = "") -> Dict[str, Any]:
        return {
            "id": user_id or "demo-user",
            "roles": ["workshop_manager"],
            "scopeNodes": ["CMR", "CMR-DLA"],
            "brands": ["TOYOTA", "PEUGEOT"],
            "email": "chef.atelier@cfao.com",
            "locale": "fr",
        }

class PlatformIdentityProvider:
    """Mode intégré : appel sécurisé vers CFAO Core."""
    def resolve_user(self, user_id: str, raw_token: str = "") -> Dict[str, Any]:
        cache_key = f"user:scope:{user_id}"
        resolved = cache.get(cache_key)
        if resolved is not None:
            return resolved

        url = f"{settings.PLATFORM_CORE_URL.rstrip('/')}/api/v1/core/me"
        try:
            resp = requests.get(
                url,
                headers={"Authorization": f"Bearer {raw_token}"},
                timeout=5,
            )
            resp.raise_for_status()
            data = resp.json()
            cache.set(cache_key, data, timeout=60)
            return data
        except Exception:
            # Comportement fail-closed : retourne un dictionnaire minimal sans droits
            return {"id": user_id, "roles": [], "scopeNodes": [], "brands": []}

def get_identity_provider() -> IdentityProvider:
    if getattr(settings, "DEPLOYMENT_MODE", "standalone") == "integrated":
        return PlatformIdentityProvider()
    return LocalMockIdentityProvider()
