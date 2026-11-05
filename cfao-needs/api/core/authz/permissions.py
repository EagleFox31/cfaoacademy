"""PEP (Policy Enforcement Point) DRF → appelle Cerbos. **Default-deny.**

Une vue doit déclarer :
  - cerbos_resource_kind = "<kind>"
  - cerbos_action  : str | callable(request) -> str   (ou ACTION_MAP par méthode)
  - get_cerbos_target(request) -> (resource_id, attr)  [niveau collection]
  - get_cerbos_object(obj)     -> (resource_id, attr)  [niveau objet]
Si le kind n'est pas déclaré, l'accès est refusé.
"""
from __future__ import annotations

from rest_framework.permissions import BasePermission

from . import cerbos

# Méthode HTTP → action Cerbos par défaut (surchargée par cerbos_action si présent).
_METHOD_ACTION = {
    "GET": "view",
    "HEAD": "view",
    "OPTIONS": "view",
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}

# Action DRF ViewSet → action Cerbos.
_VIEWSET_ACTION = {
    "list": "list",
    "create": "create",
    "retrieve": "view",
    "update": "update",
    "partial_update": "update",
    "destroy": "delete",
}


def _resolve_action(view, request) -> str:
    action = getattr(view, "cerbos_action", None)
    if callable(action):
        return action(request)
    if isinstance(action, str):
        return action
    viewset_action = getattr(view, "action", None)
    if viewset_action in _VIEWSET_ACTION:
        return _VIEWSET_ACTION[viewset_action]
    return _METHOD_ACTION.get(request.method, request.method.lower())


class CerbosPermission(BasePermission):
    message = "Action non autorisée par la politique d'accès."

    def has_permission(self, request, view) -> bool:
        kind = getattr(view, "cerbos_resource_kind", None)
        if not kind:
            return False  # default-deny : pas de kind déclaré ⇒ refus
        if not getattr(request.user, "is_authenticated", False):
            return False

        action = _resolve_action(view, request)
        # Pour un ViewSet, seul 'create' (collection) est checké ici. Les autres actions
        # sont enforced ailleurs : 'list' par le query plan (get_queryset), le détail par
        # has_object_permission (objet réel), et les actions custom par LEUR PROPRE check
        # Cerbos explicite (convention). Un check « collection » fictif donnerait un faux refus.
        viewset_action = getattr(view, "action", None)
        if viewset_action is not None and viewset_action != "create":
            return True
        if hasattr(view, "get_cerbos_target"):
            resource_id, attr = view.get_cerbos_target(request)
        else:
            resource_id, attr = "*", {}
        return cerbos.check(request.user.to_cerbos(), kind, resource_id, attr, action)

    def has_object_permission(self, request, view, obj) -> bool:
        kind = getattr(view, "cerbos_resource_kind", None)
        if not kind:
            return False
        action = _resolve_action(view, request)
        if hasattr(view, "get_cerbos_object"):
            resource_id, attr = view.get_cerbos_object(obj)
        else:
            resource_id, attr = str(getattr(obj, "pk", "*")), {}
        return cerbos.check(request.user.to_cerbos(), kind, resource_id, attr, action)
