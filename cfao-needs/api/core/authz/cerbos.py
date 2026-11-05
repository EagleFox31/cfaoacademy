"""Client Cerbos (PDP) — check + query plan, via l'API HTTP stable.

On parle à Cerbos en REST (POST /api/check/resources, /api/plan/resources) pour
ne dépendre d'aucune version de SDK. check() renvoie un booléen ALLOW/DENY ;
plan() renvoie le plan de requête à traduire en filtre queryset (filters.py).
"""
from __future__ import annotations

import uuid

import requests
from django.conf import settings

_TIMEOUT = 5


def _base() -> str:
    return settings.CERBOS_HTTP.rstrip("/")


def check(principal: dict, kind: str, resource_id: str, attr: dict, action: str) -> bool:
    """Décision sur UNE ressource. Toute erreur ⇒ refus (fail-closed)."""
    payload = {
        "requestId": str(uuid.uuid4()),
        "principal": principal,
        "resources": [
            {
                "resource": {"kind": kind, "id": resource_id or "_new", "attr": attr or {}},
                "actions": [action],
            }
        ],
    }
    try:
        resp = requests.post(f"{_base()}/api/check/resources", json=payload, timeout=_TIMEOUT)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            return False
        effect = results[0].get("actions", {}).get(action)
        return effect == "EFFECT_ALLOW"
    except requests.RequestException:
        # PDP indisponible ⇒ on refuse plutôt que d'ouvrir (sécurité).
        return False


def plan(principal: dict, kind: str, action: str) -> dict:
    """Query plan pour une LISTE. Renvoie le filtre Cerbos (KIND_* + condition)."""
    payload = {
        "requestId": str(uuid.uuid4()),
        "principal": principal,
        "resource": {"kind": kind},
        "action": action,
    }
    try:
        resp = requests.post(f"{_base()}/api/plan/resources", json=payload, timeout=_TIMEOUT)
        resp.raise_for_status()
        return resp.json().get("filter", {"kind": "KIND_ALWAYS_DENIED"})
    except requests.RequestException:
        return {"kind": "KIND_ALWAYS_DENIED"}
