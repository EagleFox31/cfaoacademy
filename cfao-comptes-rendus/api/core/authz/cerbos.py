"""Client Cerbos pour validation des autorisations (PEP).

API HTTP stable du PDP (`POST /api/check/resources`), comme `cfao-core`.
Toute erreur vaut refus (default-deny).
"""
import uuid

import requests
from django.conf import settings
from rest_framework.exceptions import PermissionDenied


LOT_MAX = 50


def _principal(principal: dict) -> dict:
    return {
        "id": principal.get("id", "anonymous"),
        "roles": principal.get("roles") or ["_anon"],
        "attr": principal.get("attr", {}),
    }


def _ressource(resource: dict) -> dict:
    return {
        "kind": resource["kind"],
        "id": str(resource.get("id") or "_new"),
        "attr": resource.get("attr", {}),
    }


def check_permission(principal: dict, resource: dict, action: str) -> bool:
    """Interroge le PDP Cerbos en HTTP."""
    payload = {
        "requestId": str(uuid.uuid4()),
        "principal": _principal(principal),
        "resources": [{"resource": _ressource(resource), "actions": [action]}],
    }

    url = f"{settings.CERBOS_HTTP.rstrip('/')}/api/check/resources"
    try:
        resp = requests.post(url, json=payload, timeout=3)
        resp.raise_for_status()
        results = resp.json().get("results") or [{}]
        return results[0].get("actions", {}).get(action) == "EFFECT_ALLOW"
    except Exception:
        # Default-deny en cas d'erreur
        return False


def check_resources(principal: dict, resources: list[dict], action: str) -> dict[str, bool]:
    """Interroge le PDP pour plusieurs ressources : une requete par lot de `LOT_MAX`.

    Rend `{id: autorise}` pour chaque ressource (l'id est celui de la ressource,
    en texte). Un echec du PDP, de n'importe quel lot, refuse tout (default-deny).
    """
    demandees = [_ressource(r) for r in resources]
    refus = {r["id"]: False for r in demandees}
    url = f"{settings.CERBOS_HTTP.rstrip('/')}/api/check/resources"
    autorises = {}
    try:
        for i in range(0, len(demandees), LOT_MAX):
            lot = demandees[i:i + LOT_MAX]
            payload = {
                "requestId": str(uuid.uuid4()),
                "principal": _principal(principal),
                "resources": [{"resource": r, "actions": [action]} for r in lot],
            }
            resp = requests.post(url, json=payload, timeout=3)
            resp.raise_for_status()
            results = resp.json().get("results")
            if not isinstance(results, list) or len(results) != len(lot):
                return refus
            # Apparie par id de ressource, pas par position : le PDP ne
            # garantit pas l'ordre des resultats.
            ids_lot = {r["id"] for r in lot}
            for res in results:
                rid = str((res.get("resource") or {}).get("id", ""))
                if rid in ids_lot:
                    autorises[rid] = res.get("actions", {}).get(action) == "EFFECT_ALLOW"
    except Exception:
        # Default-deny en cas d'erreur
        return refus
    return {**refus, **autorises}


def enforce_permission(principal: dict, resource: dict, action: str):
    """Leve une exception 403 si l'action est refusee."""
    if not check_permission(principal, resource, action):
        raise PermissionDenied(f"Action '{action}' non autorisee sur cette ressource.")
