"""Le « principal » : qui agit, avec quels rôles et quel périmètre.

Le token porte l'identité et les rôles ; le périmètre est complété par
`IdentityProvider` (identity.py). Voir architecture.md §6.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Principal:
    id: str
    roles: list[str] = field(default_factory=list)
    attr: dict = field(default_factory=dict)
    raw_token: str = ""
    display_name: str = ""

    # DRF traite cet objet comme request.user.
    @property
    def is_authenticated(self) -> bool:
        return True

    def to_cerbos(self) -> dict:
        """Principal au format attendu par Cerbos."""
        return {"id": self.id, "roles": self.roles or ["_anon"], "attr": self.attr}


def build_principal(claims: dict) -> Principal:
    """Construit le principal à partir des claims du JWT.

    Le périmètre lu ici n'est qu'un point de départ : il est écrasé par la
    résolution `IdentityProvider` si le compte est connu. Un compte inconnu garde
    donc un périmètre vide — et les policies default-deny le refusent.
    """
    roles = (claims.get("realm_access") or {}).get("roles") or []
    scope_node = claims.get("scopeNode", "")
    attr = {
        # MULTI-SCOPE : liste de nœuds (le token n'en porte qu'un ; la base peut en avoir plusieurs).
        "scopeNodes": [scope_node] if scope_node else [],
        "departments": claims.get("departments", []),
        "brands": claims.get("brands", []),
        "locale": claims.get("locale", "fr"),
    }
    name = claims.get("name") or claims.get("preferred_username") or ""
    return Principal(id=claims["sub"], roles=roles, attr=attr, display_name=name)
