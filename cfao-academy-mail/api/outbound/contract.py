"""Contrat OpenAPI publié pour les modules appelants.

La source exécutable est le catalogue (`required_context`). Le fichier
`contract/mail.openapi.json` en est la copie que les autres dépôts lisent.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from outbound.catalog import LOCALES, MESSAGE_TYPES, MessageType

CONTRACT_VERSION = "0.2.0"
CONTRACT_PATH = Path(__file__).resolve().parent / "contract" / "mail.openapi.json"


def _schema_name(key: str) -> str:
    return "Enqueue" + "".join(part.capitalize() for part in key.replace(".", "_").split("_"))


def _context_property(message_type: MessageType, key: str) -> dict:
    patterns = dict(message_type.context_patterns)
    if key in patterns:
        return {"type": ["string", "integer"], "pattern": f"^{patterns[key]}$"}
    return {"type": ["string", "number"]}


def _request_schema(message_type: MessageType) -> dict:
    context_required = [key for key in message_type.required_context if key != "module_url"]
    required = ["kind", "to", "context"]
    properties: dict = {
        "kind": {"type": "string", "enum": [message_type.key]},
        "to": {"$ref": "#/components/schemas/EmailList"},
        "cc": {"$ref": "#/components/schemas/EmailList"},
        "reply_to": {"type": "string", "format": "email"},
        "locale": {"type": "string", "enum": list(LOCALES), "default": "fr"},
        "context": {
            "type": "object",
            "required": context_required,
            "properties": {key: _context_property(message_type, key) for key in context_required},
            "additionalProperties": True,
        },
        "source_app": {"type": "string", "maxLength": 32},
        "source_ref": {"type": "string", "maxLength": 128},
        "correlation_id": {"type": "string", "maxLength": 160},
    }
    if "module_url" in message_type.required_context:
        properties["module_url"] = {
            "type": "string",
            "format": "uri",
            "description": "Adresse absolue du bouton, choisie par le module.",
        }
    else:
        properties["module_url"] = {"type": "string", "format": "uri"}
    if message_type.sensitive:
        # Message sensible : sans copie, avec une échéance (refusée sur les autres types).
        del properties["cc"]
        properties["expires_at"] = {
            "type": "string",
            "format": "date-time",
            "description": "Échéance du code ou du lien. Passée, le message n'est pas envoyé (EXPIRED).",
        }
        required.append("expires_at")
    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": required,
        "properties": properties,
        "description": message_type.description,
        "x-required-context": list(message_type.required_context),
    }
    if message_type.sensitive:
        schema["x-secret-context"] = list(message_type.secret_context)
    if message_type.allowed_sources:
        schema["x-allowed-sources"] = list(message_type.allowed_sources)
    if "module_url" in message_type.required_context:
        schema["anyOf"] = [
            {"required": ["module_url"]},
            {"required": ["context"], "properties": {"context": {"required": ["module_url"]}}},
        ]
    return schema


def openapi_document() -> dict:
    schemas = {
        "EmailList": {
            "type": "array",
            "minItems": 1,
            "items": {"type": "string", "format": "email"},
        },
        "EnqueueResponse": {
            "type": "object",
            "additionalProperties": False,
            "required": ["message", "created"],
            "properties": {
                "created": {"type": "boolean"},
                "message": {"$ref": "#/components/schemas/OutboundMessage"},
            },
        },
        "OutboundMessage": {
            "type": "object",
            "required": [
                "id", "kind", "status", "source_app", "source_ref", "correlation_id",
                "to", "cc", "reply_to", "locale", "created_at", "updated_at",
            ],
            "properties": {
                "id": {"type": "string"},
                "kind": {"type": "string"},
                "status": {
                    "type": "string",
                    "enum": ["PENDING_REVIEW", "APPROVED", "SENT", "FAILED", "REJECTED", "EXPIRED"],
                },
                "source_app": {"type": "string"},
                "source_ref": {"type": "string"},
                "correlation_id": {"type": ["string", "null"]},
                "to": {"type": "array", "items": {"type": "string"}},
                "cc": {"type": "array", "items": {"type": "string"}},
                "reply_to": {"type": "string"},
                "locale": {"type": "string"},
                "created_at": {"type": "string"},
                "updated_at": {"type": "string"},
            },
        },
        "Error": {
            "type": "object",
            "required": ["detail"],
            "properties": {"detail": {"type": "string"}},
        },
        "Health": {
            "type": "object",
            "additionalProperties": False,
            "required": ["status", "service"],
            "properties": {
                "status": {"const": "ok"},
                "service": {"const": "cfao-academy-mail"},
            },
        },
    }
    one_of = []
    for message_type in MESSAGE_TYPES:
        name = _schema_name(message_type.key)
        schemas[name] = _request_schema(message_type)
        one_of.append({"$ref": f"#/components/schemas/{name}"})

    return {
        "openapi": "3.1.0",
        "info": {
            "title": "CFAO Academy Mail",
            "version": CONTRACT_VERSION,
            "description": (
                "Hub d'envoi. Les modules passent le contexte et l'adresse du bouton. "
                "Un champ requis manquant est refusé (400), le mail n'est pas envoyé. "
                "Message sensible (x-secret-context) : les secrets ne sont jamais stockés en clair, "
                "le message part une seule fois et seule une clé liée à x-allowed-sources peut l'envoyer."
            ),
        },
        "paths": {
            "/api/v1/mail/healthz": {
                "get": {
                    "operationId": "healthz",
                    "security": [],
                    "responses": {
                        "200": {
                            "description": "Sonde.",
                            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Health"}}},
                        },
                    },
                },
            },
            "/api/v1/mail/contract": {
                "get": {
                    "operationId": "contract",
                    "security": [],
                    "responses": {
                        "200": {"description": "Ce document OpenAPI."},
                    },
                },
            },
            "/api/v1/mail/messages/enqueue": {
                "post": {
                    "operationId": "enqueue",
                    "security": [{"serviceKey": []}],
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {"oneOf": one_of},
                            },
                        },
                    },
                    "responses": {
                        "201": {
                            "description": "Message créé.",
                            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/EnqueueResponse"}}},
                        },
                        "200": {
                            "description": "Déjà en file (correlation_id).",
                            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/EnqueueResponse"}}},
                        },
                        "400": {
                            "description": "Type inconnu ou champs requis manquants.",
                            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}},
                        },
                        "403": {
                            "description": "Clé X-Mail-Service-Key absente, invalide ou non autorisée pour ce type.",
                            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}}},
                        },
                    },
                },
            },
        },
        "components": {
            "securitySchemes": {
                "serviceKey": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "X-Mail-Service-Key",
                },
            },
            "schemas": schemas,
        },
    }


def render() -> str:
    """Sérialisation stable : ordre du catalogue, LF, une ligne vide finale."""
    return json.dumps(openapi_document(), indent=2, ensure_ascii=False) + "\n"


def publish(path: Path = CONTRACT_PATH) -> bool:
    """Écrit le contrat s'il a changé. Octets, pas texte : pas de CRLF sous Windows."""
    content = render().encode("utf-8")
    if path.is_file() and path.read_bytes() == content:
        return False
    path.write_bytes(content)
    return True


if __name__ == "__main__":
    import django

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.test")
    django.setup()
    print(f"{CONTRACT_PATH.name} {CONTRACT_VERSION} : {'écrit' if publish() else 'inchangé'}")
