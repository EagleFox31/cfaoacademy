"""Client Cerbos pour validation des autorisations (PEP)."""
import requests
from django.conf import settings
from rest_framework.exceptions import PermissionDenied

def check_permission(principal: dict, resource: dict, action: str) -> bool:
    """Interroge le PDP Cerbos en HTTP."""
    payload = {
        "principal": {
            "id": principal.get("id", "anonymous"),
            "roles": principal.get("roles", []),
            "attr": {
                "scopeNodes": principal.get("scopeNodes", []),
                "brands": principal.get("brands", []),
            },
        },
        "resource": {
            "kind": resource.get("kind", "sample_resource"),
            "id": str(resource.get("id", "unknown")),
            "attr": resource.get("attr", {}),
        },
        "actions": [action],
    }

    url = f"{settings.CERBOS_HTTP.rstrip('/')}/api/check"
    try:
        resp = requests.post(url, json=payload, timeout=3)
        resp.raise_for_status()
        data = resp.json()
        actions = data.get("results", [{}])[0].get("actions", {})
        return actions.get(action) == "EFFECT_ALLOW"
    except Exception:
        # Default-deny en cas d'erreur
        return False

def enforce_permission(principal: dict, resource: dict, action: str):
    """Lève une exception 403 si l'action est refusée."""
    if not check_permission(principal, resource, action):
        raise PermissionDenied(f"Action '{action}' non autorisée sur cette ressource.")
