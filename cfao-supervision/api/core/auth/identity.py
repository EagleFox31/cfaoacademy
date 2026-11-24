"""Source des rôles : le jeton Keycloak seul.

La supervision n'a pas de périmètre métier (filiale, marque) : l'accès dépend du
seul rôle `platform_ops` (ou `superadmin`), que porte `realm_access.roles`.
L'interface est gardée pour rester alignée sur les autres modules (oidc.py).
"""
from __future__ import annotations


class TokenIdentityProvider:
    def resolve(self, principal) -> None:
        return None


def get_identity_provider() -> TokenIdentityProvider:
    return TokenIdentityProvider()
