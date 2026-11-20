"""Contrat OpenAPI `needs-snapshot-push` : ce que cfao-planning accepte de cfao-needs.

Source unique : ce module. `contract/needs-snapshot.openapi.json` en est la copie
publiée, lue par le registre `contracts/`. Regénérer : `python -m planning.contract`
(depuis `cfao-planning/api`).
"""
from __future__ import annotations

import json
from pathlib import Path

CONTRACT_ID = "needs-snapshot-push"
CONTRACT_VERSION = "1.0.0"
CONTRACT_PATH = Path(__file__).resolve().parent / "contract" / "needs-snapshot.openapi.json"

_POLES = ("motors", "equipment", "all")


def _by_pole() -> dict:
    return {"type": "object", "required": list(_POLES),
            "properties": {p: {"type": "object"} for p in _POLES}}


def openapi_document() -> dict:
    envelope = {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}}
    year = {
        "type": "object",
        "required": ["needs_by_branch_brand", "unchosen_modules", "catalog_levels"],
        "description": "Corps des lectures `needs-analytics` de l'année (même forme que ses GET).",
        "properties": {
            "needs_by_branch_brand": _by_pole(),
            "unchosen_modules": _by_pole(),
            "catalog_levels": {"type": "object", "required": ["lines"]},
        },
    }
    schemas = {
        "NeedsSnapshot": {
            "type": "object",
            "required": ["version", "generated_at", "years"],
            "properties": {
                "version": {"type": "integer", "minimum": 0},
                "generated_at": {"type": "string", "format": "date-time"},
                "years": {"type": "object", "additionalProperties": year},
            },
        },
        "PushResult": {
            "type": "object",
            "required": ["applied", "version"],
            "properties": {
                "applied": {"type": "boolean", "description": "Faux si la version était déjà connue."},
                "version": {"type": ["integer", "null"], "description": "Version de la copie après l'appel."},
            },
            "examples": [{"applied": True, "version": 42}],
        },
        "Error": {"type": "object", "required": ["detail"], "properties": {"detail": {"type": "string"}}},
    }
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "CFAO Planning — copie des besoins",
            "version": CONTRACT_VERSION,
            "description": "cfao-needs pousse sa copie complète à chaque changement (relais `needs-relay`). "
                           "Idempotent : une version déjà connue ou plus ancienne ne change rien.",
        },
        "security": [{"NeedsSnapshotKey": []}],
        "paths": {
            "/api/v1/planning/internal/needs-snapshot": {
                "post": {
                    "operationId": "pushNeedsSnapshot",
                    "summary": "Reçoit la copie des besoins (réseau interne seulement).",
                    "parameters": [],
                    "requestBody": {
                        "required": True,
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/NeedsSnapshot"}}},
                    },
                    "responses": {
                        "200": {
                            "description": "Reçue ; appliquée seulement si plus récente.",
                            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/PushResult"}}},
                        },
                        "400": {"description": "Document invalide : rien n'est écrit.", "content": envelope},
                        "403": {"description": "Clé `X-Needs-Snapshot-Key` absente ou invalide.", "content": envelope},
                    },
                }
            }
        },
        "components": {
            "schemas": schemas,
            "securitySchemes": {
                "NeedsSnapshotKey": {"type": "apiKey", "in": "header", "name": "X-Needs-Snapshot-Key"},
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
