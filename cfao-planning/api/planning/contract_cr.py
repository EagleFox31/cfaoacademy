"""Contrat OpenAPI `cr-sessions` : sessions à documenter, lues par le module Comptes rendus.

Source unique : ce module. `contract/cr-sessions.openapi.json` en est la copie
publiée, lue par le registre `contracts/`. Regénérer : `python -m planning.contract_cr`
(depuis `cfao-planning/api`).
"""
from __future__ import annotations

import json
from pathlib import Path

CONTRACT_ID = "cr-sessions"
CONTRACT_VERSION = "1.0.0"
CONTRACT_PATH = Path(__file__).resolve().parent / "contract" / "cr-sessions.openapi.json"
PATH = "/api/v1/planning/internal/cr-sessions"
# Fenêtre de lecture (jours) : défaut et plafond, repris par le service.
DEFAULT_DAYS = 60
MAX_DAYS = 400

_EXAMPLE_SESSION = {
    "id": "6f1c2a9e-1b7d-4c55-9a3e-2f0d8c4b7a10",
    "revision": "3b9f0c1d2e4a5b6c7d8e",
    "year": 2026,
    "code": "TS03",
    "code_norm": "TS03",
    "title": "Systèmes hydrauliques",
    "brand": {"code": "marque-a", "label": "Marque A"},
    "pole": "EQUIPMENT",
    "country": {"code": "cm", "label": "Cameroun"},
    "location": "Douala",
    "delivery_mode": "PRESENTIEL",
    "start_date": "2026-11-09",
    "end_date": "2026-11-13",
    "days": 5,
    "trainers": [{"id": "0d4e8b2a-5c1f-4e7a-9b3d-6a2c1f0e9d84", "name": "Formateur A",
                  "kind": "TRAINER", "is_external": False, "sub": None}],
}


def _ref(name: str) -> dict:
    return {"$ref": f"#/components/schemas/{name}"}


def _labelled() -> dict:
    return {"type": "object", "required": ["code", "label"],
            "properties": {"code": {"type": "string"}, "label": {"type": "string"}}}


def openapi_document() -> dict:
    envelope = {"application/json": {"schema": _ref("Error")}}
    date = {"type": "string", "format": "date"}
    schemas = {
        "Trainer": {
            "type": "object",
            "required": ["id", "name", "kind", "is_external", "sub"],
            "properties": {
                "id": {"type": "string", "format": "uuid"},
                "name": {"type": "string"},
                "kind": {"type": "string", "description": "TRAINER ou TECH_INSTRUCTOR (liste ouverte)."},
                "is_external": {"type": "boolean"},
                "sub": {"type": ["string", "null"], "description": "Compte Keycloak relié ; null tant qu'il ne s'est pas connecté."},
            },
        },
        "Session": {
            "type": "object",
            "required": ["id", "revision", "year", "code", "code_norm", "title", "brand", "pole",
                         "country", "location", "delivery_mode", "start_date", "end_date", "days",
                         "trainers"],
            "properties": {
                "id": {"type": "string", "format": "uuid", "description": "Identifiant stable de la session au planning."},
                "revision": {"type": "string", "description": "Empreinte du contenu : change dès qu'un champ change."},
                "year": {"type": "integer"},
                "code": {"type": "string", "description": "Code tel que saisi au planning."},
                "code_norm": {"type": "string"},
                "title": {"type": "string"},
                "brand": _labelled(),
                "pole": {"type": "string"},
                "country": _labelled(),
                "location": {"type": "string"},
                "delivery_mode": {"type": "string"},
                "start_date": date,
                "end_date": {**date, "description": "Égale au début pour une session d'un jour."},
                "days": {"type": "integer", "minimum": 0, "description": "Jours ouvrés."},
                "trainers": {"type": "array", "items": _ref("Trainer")},
            },
        },
        "SessionsToDocument": {
            "type": "object",
            "required": ["revision", "window", "sessions"],
            "properties": {
                "revision": {"type": "string", "description": "Empreinte de la liste ; même valeur que l'ETag."},
                "window": {
                    "type": "object", "required": ["ended_from", "ended_to"],
                    "properties": {"ended_from": date, "ended_to": date},
                },
                "sessions": {"type": "array", "items": _ref("Session")},
            },
            "examples": [{
                "revision": "9a8b7c6d5e4f3a2b1c0d",
                "window": {"ended_from": "2026-09-21", "ended_to": "2026-11-20"},
                "sessions": [_EXAMPLE_SESSION],
            }],
        },
        "Error": {"type": "object", "required": ["detail"], "properties": {"detail": {"type": "string"}}},
    }
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "CFAO Planning — sessions à documenter",
            "version": CONTRACT_VERSION,
            "description": "Le planning fait foi pour les sessions ; le module Comptes rendus en garde "
                           "une copie locale et la rafraîchit par GET conditionnel (If-None-Match). "
                           "Réseau interne seulement : l'edge ne publie pas `/internal/`.",
        },
        "security": [{"CrSessionsKey": []}],
        "paths": {
            PATH: {
                "get": {
                    "operationId": "listSessionsToDocument",
                    "summary": "Sessions terminées dans les `days` derniers jours, aujourd'hui compris.",
                    "parameters": [
                        {"name": "days", "in": "query", "required": False,
                         "schema": {"type": "integer", "minimum": 1, "maximum": MAX_DAYS, "default": DEFAULT_DAYS}},
                        {"name": "trainer", "in": "query", "required": False,
                         "description": "Compte Keycloak du formateur ; non relié = liste vide.",
                         "schema": {"type": "string"}},
                        {"name": "If-None-Match", "in": "header", "required": False,
                         "schema": {"type": "string"}},
                    ],
                    "responses": {
                        "200": {
                            "description": "Liste à jour ; en-tête `ETag` = `revision`.",
                            "headers": {"ETag": {"schema": {"type": "string"}}},
                            "content": {"application/json": {"schema": _ref("SessionsToDocument")}},
                        },
                        "304": {"description": "Rien n'a changé depuis l'ETag fourni."},
                        "400": {"description": "Paramètre invalide.", "content": envelope},
                        "403": {"description": "Clé `X-Cr-Sessions-Key` absente ou invalide.", "content": envelope},
                    },
                }
            }
        },
        "components": {
            "schemas": schemas,
            "securitySchemes": {
                "CrSessionsKey": {"type": "apiKey", "in": "header", "name": "X-Cr-Sessions-Key"},
            },
        },
    }


def render() -> str:
    """Sérialisation stable : clés triées, LF, une ligne vide finale."""
    return json.dumps(openapi_document(), indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def publish(path: Path = CONTRACT_PATH) -> bool:
    content = render().encode("utf-8")
    if path.is_file() and path.read_bytes() == content:
        return False
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(content)
    return True


if __name__ == "__main__":
    print(f"{CONTRACT_PATH.name} {CONTRACT_VERSION} : {'écrit' if publish() else 'inchangé'}")
