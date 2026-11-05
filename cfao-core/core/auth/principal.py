"""Le « principal » : qui agit, avec quels rôles et quel périmètre.

Source de vérité du scope = module identity (pas Keycloak). Au démarrage on lit
le scope depuis les claims s'ils existent (protocol mapper), sinon on le résoudra
côté service via identity (avec cache). Voir architecture.md §6.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Principal:
    id: str
    roles: list[str] = field(default_factory=list)
    attr: dict = field(default_factory=dict)
    username: str = ""  # preferred_username du JWT (ex : venance.tonga)

    # DRF traite cet objet comme request.user.
    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def sub(self) -> str:
        """Alias historique — quelques vues lisent request.user.sub."""
        return self.id

    def to_cerbos(self) -> dict:
        """Principal au format attendu par Cerbos."""
        return {"id": self.id, "roles": self.roles or ["_anon"], "attr": self.attr}


def build_principal(claims: dict) -> Principal:
    """Construit le principal à partir des claims du JWT (périmètre potentiellement
    surchargé ensuite par la résolution DB côté service — cf. oidc.py)."""
    roles = (claims.get("realm_access") or {}).get("roles") or []
    scope_node = claims.get("scopeNode", "")
    attr = {
        # MULTI-SCOPE : liste de nœuds (le token n'en porte qu'un ; la DB peut en avoir plusieurs).
        "scopeNodes": [scope_node] if scope_node else [],
        "departments": claims.get("departments", []),
        "brands": claims.get("brands", []),
    }
    return Principal(
        id=claims["sub"],
        roles=roles,
        attr=attr,
        username=claims.get("preferred_username", ""),
    )
