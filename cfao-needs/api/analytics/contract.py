"""Contrat OpenAPI des agrégats lus par cfao-core.

Source unique : ce module. `contract/needs-analytics.openapi.json` en est la
copie publiée que lisent les consommateurs et le registre `contracts/`.
Regénérer : `python -m analytics.contract` (depuis `cfao-needs/api`).
"""

from __future__ import annotations

import json
from pathlib import Path

CONTRACT_ID = "needs-analytics"
CONTRACT_VERSION = "1.0.0"
CONTRACT_PATH = Path(__file__).resolve().parent / "contract" / "needs-analytics.openapi.json"

_YEAR = {
    "name": "year",
    "in": "query",
    "required": False,
    "description": "Année de campagne. Défaut : année en cours.",
    "schema": {"type": "integer"},
}
_ERRORS = {
    "400": {
        "description": "`year` n'est pas un entier.",
        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}},
    },
    "403": {
        "description": "Clé `X-Analytics-Key` absente ou invalide (DRF sans authentificateur : 403).",
        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ErrorEnvelope"}}},
    },
}


def _operation(operation_id: str, summary: str, parameters: list, schema: str) -> dict:
    return {
        "get": {
            "operationId": operation_id,
            "summary": summary,
            "parameters": parameters,
            "responses": {
                "200": {
                    "description": "Agrégat.",
                    "content": {"application/json": {"schema": {"$ref": f"#/components/schemas/{schema}"}}},
                },
                **_ERRORS,
            },
        }
    }


def openapi_document() -> dict:
    schemas = {
        "TotalTechnicians": {
            "type": "object",
            "required": ["bu", "year", "count"],
            "properties": {
                "bu": {"type": "string", "enum": ["equipment", "motors", "all"]},
                "year": {"type": "integer"},
                "count": {"type": "integer", "minimum": 0},
            },
            "examples": [{"bu": "equipment", "year": 2026, "count": 392}],
        },
        "AllocationsPerBranch": {
            "type": "object",
            "required": ["year", "allocations"],
            "properties": {
                "year": {"type": "integer"},
                "allocations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["country", "seats"],
                        "properties": {
                            "country": {"type": "string"},
                            "seats": {"type": "integer", "minimum": 0},
                        },
                    },
                },
            },
            "examples": [{"year": 2026, "allocations": [{"country": "TOGO", "seats": 264}]}],
        },
        "ScheduledTrainings": {
            "type": "object",
            "required": ["year", "count"],
            "properties": {
                "year": {"type": "integer"},
                "count": {"type": "integer", "minimum": 0},
            },
            "examples": [{"year": 2026, "count": 180}],
        },
        "Error": {
            "type": "object",
            "required": ["detail"],
            "properties": {"detail": {"type": "string"}},
        },
        "ErrorEnvelope": {
            "type": "object",
            "required": ["error"],
            "properties": {
                "error": {
                    "type": "object",
                    "required": ["code", "message"],
                    "properties": {
                        "code": {"type": "string"},
                        "message": {"type": "string"},
                        "details": {"type": "object"},
                    },
                },
            },
        },
    }
    bu = {
        "name": "bu",
        "in": "query",
        "required": False,
        "description": "Pôle. Valeur inconnue traitée comme `all`.",
        "schema": {"type": "string", "enum": ["equipment", "motors", "all"]},
    }
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "CFAO Needs Analytics",
            "version": CONTRACT_VERSION,
            "description": "Agrégats de service à service lus par cfao-core (tableau de bord super admin).",
        },
        "security": [{"AnalyticsKey": []}],
        "paths": {
            "/api/v1/needs/analytics/total-technicians": _operation(
                "totalTechnicians", "Techniciens par pôle (Clé de Répartition).", [bu, _YEAR], "TotalTechnicians"
            ),
            "/api/v1/needs/analytics/allocations-per-branch": _operation(
                "allocationsPerBranch", "Places allouées par pays.", [_YEAR], "AllocationsPerBranch"
            ),
            "/api/v1/needs/analytics/scheduled-trainings": _operation(
                "scheduledTrainings", "Sessions programmées.", [_YEAR], "ScheduledTrainings"
            ),
        },
        "components": {
            "schemas": schemas,
            "securitySchemes": {
                "AnalyticsKey": {"type": "apiKey", "in": "header", "name": "X-Analytics-Key"},
            },
        },
    }


def render() -> str:
    """Sérialisation stable : clés triées, LF, une ligne vide finale."""
    return json.dumps(openapi_document(), indent=2, ensure_ascii=False, sort_keys=True) + "\n"


if __name__ == "__main__":
    CONTRACT_PATH.parent.mkdir(exist_ok=True)
    with CONTRACT_PATH.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(render())
    print(f"{CONTRACT_PATH.name} {CONTRACT_VERSION}")
