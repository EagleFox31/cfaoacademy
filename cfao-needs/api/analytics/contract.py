"""Contrat OpenAPI des agrégats lus par cfao-core.

Source unique : ce module. `contract/needs-analytics.openapi.json` en est la
copie publiée que lisent les consommateurs et le registre `contracts/`.
Regénérer : `python -m analytics.contract` (depuis `cfao-needs/api`).
"""

from __future__ import annotations

import json
from pathlib import Path

CONTRACT_ID = "needs-analytics"
CONTRACT_VERSION = "1.1.0"
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
        "NeedsByBranchBrand": {
            "type": "object",
            "required": ["year", "pole", "source", "rows"],
            "properties": {
                "year": {"type": "integer"},
                "pole": {"type": "string", "enum": ["motors", "equipment", "all"]},
                "source": {"type": "string", "enum": ["submissions", "quota_import", "none"]},
                "rows": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["country", "brand", "needs", "technicians"],
                        "properties": {
                            "country": {"type": "string"},
                            "brand": {"type": "string"},
                            "needs": {"type": "integer", "minimum": 0},
                            "technicians": {"type": ["integer", "null"], "minimum": 0},
                        },
                    },
                },
            },
            "examples": [{"year": 2026, "pole": "motors", "source": "quota_import", "rows": [
                {"country": "BENIN", "brand": "TOYOTA", "needs": 34, "technicians": 22}]}],
        },
        "UnchosenModules": {
            "type": "object",
            "required": ["year", "pole", "catalog_available", "modules"],
            "properties": {
                "year": {"type": "integer"},
                "pole": {"type": "string", "enum": ["motors", "equipment", "all"]},
                "catalog_available": {"type": "boolean"},
                "modules": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["pole", "brand", "tier", "code", "title"],
                        "properties": {
                            "pole": {"type": "string"},
                            "brand": {"type": ["string", "null"]},
                            "tier": {"type": ["string", "null"], "enum": ["JUNIOR", "SENIOR", "EXPERT", None]},
                            "code": {"type": "string"},
                            "title": {"type": "string"},
                        },
                    },
                },
            },
            "examples": [{"year": 2027, "pole": "motors", "catalog_available": True, "modules": [
                {"pole": "MOBILITY", "brand": "Toyota", "tier": "EXPERT", "code": "TS14-G1",
                 "title": "Diagnostic"}]}],
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
    pole = {**bu, "name": "pole"}
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "CFAO Needs Analytics",
            "version": CONTRACT_VERSION,
            "description": "Agrégats de service à service lus par cfao-core (tableau de bord super admin) "
                           "et cfao-planning (clé de répartition).",
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
            "/api/v1/needs/analytics/needs-by-branch-brand": _operation(
                "needsByBranchBrand", "Besoins et techniciens par pays et marque (cfao-planning).",
                [pole, _YEAR], "NeedsByBranchBrand"
            ),
            "/api/v1/needs/analytics/unchosen-modules": _operation(
                "unchosenModules", "Modules du catalogue sans aucune demande validée (cfao-planning).",
                [pole, _YEAR], "UnchosenModules"
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


def publish(path: Path = CONTRACT_PATH) -> bool:
    """Écrit la copie publiée seulement si elle diffère de la source. True si écrit."""
    content = render().encode("utf-8")
    if path.is_file() and path.read_bytes() == content:
        return False
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(content)
    return True


if __name__ == "__main__":
    print(f"{CONTRACT_PATH.name} {CONTRACT_VERSION} : {'écrit' if publish() else 'inchangé'}")
