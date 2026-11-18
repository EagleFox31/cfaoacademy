"""Client Cerbos (PDP) — check + query plan, via l'API HTTP stable.

On parle à Cerbos en REST (POST /api/check/resources, /api/plan/resources) pour
ne dépendre d'aucune version de SDK. check() renvoie un booléen ALLOW/DENY ;
plan() renvoie le plan de requête à traduire en filtre queryset (filters.py).
"""
from __future__ import annotations

import logging
import threading
import time
import uuid

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 5
# Une décision est une lecture : la rejouer une fois sur un incident réseau est sans effet de bord.
_ATTEMPTS = 2
_local = threading.local()


def _base() -> str:
    return settings.CERBOS_HTTP.rstrip("/")


def _session() -> requests.Session:
    """Une connexion gardée ouverte par fil (gunicorn gthread) : pas de poignée TCP par décision."""
    if getattr(_local, "session", None) is None:
        _local.session = requests.Session()
    return _local.session


def _post(path: str, payload: dict) -> dict:
    """Appel au PDP, rejoué une fois sur délai dépassé ou connexion coupée.

    Lève requests.RequestException si le PDP reste injoignable : l'appelant refuse
    (fail-closed). Le journal dit pourquoi, sinon un refus passager se lit comme un
    vrai « accès refusé » (403) sans trace.
    """
    for attempt in range(1, _ATTEMPTS + 1):
        started = time.monotonic()
        try:
            resp = _session().post(f"{_base()}{path}", json=payload, timeout=_TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except (requests.Timeout, requests.ConnectionError) as exc:
            _local.session = None  # connexion douteuse : la suivante repart de zéro
            logger.warning("PDP Cerbos injoignable (essai %s/%s, %.1f s) : %s",
                           attempt, _ATTEMPTS, time.monotonic() - started, type(exc).__name__)
            if attempt == _ATTEMPTS:
                raise
        except requests.RequestException as exc:
            logger.warning("PDP Cerbos en erreur : %s", exc)
            raise
    raise requests.RequestException("PDP Cerbos injoignable")


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
        results = _post("/api/check/resources", payload).get("results", [])
        if not results:
            return False
        effect = results[0].get("actions", {}).get(action)
        return effect == "EFFECT_ALLOW"
    except (requests.RequestException, ValueError):
        # PDP indisponible ⇒ on refuse plutôt que d'ouvrir (sécurité).
        return False


def check_many(principal: dict, kind: str, resources: list[tuple[str, dict]],
               action: str) -> set[str]:
    """Une décision par ressource, en un seul appel. Renvoie les id autorisés ;
    toute erreur ⇒ aucun (fail-closed)."""
    if not resources:
        return set()
    payload = {
        "requestId": str(uuid.uuid4()),
        "principal": principal,
        "resources": [
            {"resource": {"kind": kind, "id": rid, "attr": attr or {}}, "actions": [action]}
            for rid, attr in resources
        ],
    }
    try:
        results = _post("/api/check/resources", payload).get("results", [])
    except (requests.RequestException, ValueError):
        return set()
    return {
        r.get("resource", {}).get("id")
        for r in results
        if r.get("actions", {}).get(action) == "EFFECT_ALLOW"
    }


def plan(principal: dict, kind: str, action: str) -> dict:
    """Query plan pour une LISTE. Renvoie le filtre Cerbos (KIND_* + condition)."""
    payload = {
        "requestId": str(uuid.uuid4()),
        "principal": principal,
        "resource": {"kind": kind},
        "action": action,
    }
    try:
        return _post("/api/plan/resources", payload).get("filter", {"kind": "KIND_ALWAYS_DENIED"})
    except (requests.RequestException, ValueError):
        return {"kind": "KIND_ALWAYS_DENIED"}
