"""Contrat OpenAPI des agrégats lus par cfao-core.

Source unique : ce module. `contract/needs-analytics.openapi.json` en est la
copie publiée que lisent les consommateurs et le registre `contracts/`.
Regénérer : `python -m analytics.contract` (depuis `cfao-needs/api`).
"""

from __future__ import annotations

import json
from pathlib import Path

CONTRACT_ID = "needs-analytics"
CONTRACT_VERSION = "1.4.0"
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


def _snapshot_operation() -> dict:
    return {
        "get": {
            "operationId": "needsSnapshot",
            "summary": "Copie complète des lectures de cfao-planning, toutes années et tous pôles.",
            "parameters": [{
                "name": "If-None-Match", "in": "header", "required": False,
                "description": "ETag d'une copie déjà connue (`\"v<version>\"`) : 304 si rien n'a changé.",
                "schema": {"type": "string"},
            }],
            "responses": {
                "200": {
                    "description": "Copie ; l'en-tête `ETag` vaut `\"v<version>\"`.",
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/NeedsSnapshot"}}},
                },
                "304": {"description": "La version demandée est toujours la dernière."},
                "403": _ERRORS["403"],
            },
        }
    }


def _by_pole(schema: str) -> dict:
    ref = {"$ref": f"#/components/schemas/{schema}"}
    return {"type": "object", "required": ["motors", "equipment", "all"],
            "properties": {"motors": ref, "equipment": ref, "all": ref}}


def _level_update_operation() -> dict:
    envelope = {"application/json": {"schema": {"type": "object"}}}
    return {
        "post": {
            "operationId": "updateCatalogLevel",
            "summary": "Corrige le niveau d'un module (cfao-planning, clé X-Catalog-Write-Key).",
            "parameters": [],
            "security": [{"CatalogWriteKey": []}],
            "requestBody": {
                "required": True,
                "content": {"application/json": {"schema": {"$ref": "#/components/schemas/CatalogLevelUpdate"}}},
            },
            "responses": {
                "200": {
                    "description": "Niveau enregistré.",
                    "content": {"application/json": {"schema": {"$ref": "#/components/schemas/CatalogLevelResult"}}},
                },
                "400": {"description": "Corps invalide, ou libellé absent du barème de la marque.", "content": envelope},
                "403": {"description": "Clé `X-Catalog-Write-Key` absente ou invalide.", "content": envelope},
                "404": {"description": "Ligne de catalogue inconnue.", "content": envelope},
                "409": {"description": "`expected` n'est plus à jour : `current` donne la valeur en base.", "content": envelope},
            },
        }
    }


def openapi_document() -> dict:
    schemas = {
        "CatalogLevels": {
            "type": "object",
            "required": ["year", "catalog_available", "lines"],
            "properties": {
                "year": {"type": "integer"},
                "catalog_available": {"type": "boolean"},
                "lines": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["id", "brand", "code", "level_label", "tier", "sort_order"],
                        "properties": {
                            "id": {"type": "string", "format": "uuid"},
                            "brand": {"type": "string"},
                            "code": {"type": "string"},
                            "family": {"type": "string", "description": "Clé de la famille du catalogue."},
                            "level_label": {"type": "string"},
                            "tier": {"type": ["string", "null"]},
                            "sort_order": {"type": "integer"},
                        },
                    },
                },
            },
            "examples": [{
                "year": 2027, "catalog_available": True,
                "lines": [{"id": "6f1c1a4e-0b7a-4b52-9d39-3a3f7f1d2c10", "brand": "TOYOTA", "code": "TS01-G4",
                           "level_label": "G4", "tier": "JUNIOR", "sort_order": 40}],
            }],
        },
        "CatalogLevelUpdate": {
            "type": "object",
            "required": ["line_ids", "expected", "level_label"],
            "properties": {
                "line_ids": {"type": "array", "items": {"type": "string", "format": "uuid"}},
                "expected": {"type": "string"},
                "level_label": {"type": "string"},
            },
        },
        "CatalogLevelResult": {
            "type": "object",
            "required": ["changed", "level_label", "tier"],
            "properties": {
                "changed": {"type": "boolean"},
                "level_label": {"type": "string"},
                "tier": {"type": ["string", "null"]},
            },
            "examples": [{"changed": True, "level_label": "G3", "tier": "SENIOR"}],
        },
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
                "postponed": {
                    "type": "array",
                    "description": "Places reportées par module ; elles restent comptées dans `needs`.",
                    "items": {
                        "type": "object",
                        "required": ["country", "brand", "code", "places"],
                        "properties": {
                            "country": {"type": "string"},
                            "brand": {"type": "string"},
                            "code": {"type": "string"},
                            "places": {"type": "integer", "minimum": 1},
                        },
                    },
                },
            },
            "examples": [{"year": 2026, "pole": "motors", "source": "quota_import", "rows": [
                {"country": "BENIN", "brand": "TOYOTA", "needs": 34, "technicians": 22}],
                "postponed": [{"country": "BENIN", "brand": "TOYOTA", "code": "TS11-G2", "places": 3}]}],
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
        "NeedsSnapshot": {
            "type": "object",
            "required": ["version", "generated_at", "years"],
            "properties": {
                "version": {"type": "integer", "minimum": 0,
                            "description": "Croît à chaque transaction qui change une donnée lue."},
                "generated_at": {"type": "string", "format": "date-time"},
                "years": {
                    "type": "object",
                    "description": "Clé = année de campagne.",
                    "additionalProperties": {
                        "type": "object",
                        "required": ["needs_by_branch_brand", "unchosen_modules", "catalog_levels"],
                        "properties": {
                            "needs_by_branch_brand": _by_pole("NeedsByBranchBrand"),
                            "unchosen_modules": _by_pole("UnchosenModules"),
                            "catalog_levels": {"$ref": "#/components/schemas/CatalogLevels"},
                        },
                    },
                },
            },
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
    year_example = {
        "needs_by_branch_brand": {p: schemas["NeedsByBranchBrand"]["examples"][0] for p in ("motors", "equipment", "all")},
        "unchosen_modules": {p: schemas["UnchosenModules"]["examples"][0] for p in ("motors", "equipment", "all")},
        "catalog_levels": schemas["CatalogLevels"]["examples"][0],
    }
    schemas["NeedsSnapshot"]["examples"] = [
        {"version": 42, "generated_at": "2026-11-10T08:00:00+00:00", "years": {"2026": year_example}}]
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
            "/api/v1/needs/analytics/catalog-levels": _operation(
                "catalogLevels", "Niveau de chaque module, dans le barème de sa marque (cfao-planning).",
                [_YEAR], "CatalogLevels"
            ),
            "/api/v1/needs/analytics/catalog-level": _level_update_operation(),
            "/api/v1/needs/analytics/snapshot": _snapshot_operation(),
        },
        "components": {
            "schemas": schemas,
            "securitySchemes": {
                "AnalyticsKey": {"type": "apiKey", "in": "header", "name": "X-Analytics-Key"},
                "CatalogWriteKey": {"type": "apiKey", "in": "header", "name": "X-Catalog-Write-Key"},
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
