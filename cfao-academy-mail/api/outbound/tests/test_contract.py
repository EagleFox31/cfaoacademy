import json

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from outbound.catalog import BY_KEY, MESSAGE_TYPES
from outbound.contract import CONTRACT_PATH, _schema_name, openapi_document
from outbound.models import OutboundMessage
from outbound.services.backends import LocMemBackend


def test_published_contract_matches_catalog():
    published = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    assert published == openapi_document()
    schemas = published["components"]["schemas"]
    seen = set()
    for message_type in MESSAGE_TYPES:
        schema = schemas[_schema_name(message_type.key)]
        assert schema["x-required-context"] == list(message_type.required_context)
        assert schema["properties"]["kind"]["enum"] == [message_type.key]
        seen.add(message_type.key)
    assert seen == set(BY_KEY)


def test_contract_endpoint_serves_the_file():
    client = APIClient()
    response = client.get("/api/v1/mail/contract")
    assert response.status_code == 200
    assert response.json()["info"]["title"] == "CFAO Academy Mail"
    assert "/api/v1/mail/messages/enqueue" in response.json()["paths"]
    assert "/api/v1/mail/healthz" in response.json()["paths"]


@pytest.mark.django_db
def test_incomplete_rapport_is_rejected(settings):
    settings.MAIL_INBOUND_KEY = "test-inbound-key"
    call_command("seed_email_templates", verbosity=0)
    client = APIClient()
    response = client.post(
        "/api/v1/mail/messages/enqueue",
        {
            "kind": "rapports.cr_steps_missing",
            "to": ["formateur@filiale.example.com"],
            "context": {"display_name": "Jean", "session_code": "TS04-G3"},
        },
        format="json",
        HTTP_X_MAIL_SERVICE_KEY="test-inbound-key",
    )
    assert response.status_code == 400
    detail = response.json()["detail"]
    for field in ("brand", "level", "training_title", "session_date", "country", "module_url", "missing_pages"):
        assert field in detail
    assert OutboundMessage.objects.count() == 0
    assert LocMemBackend.outbox == []


def _enqueue_schema():
    from jsonschema import Draft202012Validator, FormatChecker

    document = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    raw = document["paths"]["/api/v1/mail/messages/enqueue"]["post"]["requestBody"]["content"]["application/json"]["schema"]
    bundled = {"oneOf": raw["oneOf"], "$defs": document["components"]["schemas"]}
    schema = json.loads(json.dumps(bundled).replace("#/components/schemas/", "#/$defs/"))
    return Draft202012Validator(schema, format_checker=FormatChecker())


@pytest.mark.django_db
def test_server_matches_published_contract(settings):
    settings.MAIL_INBOUND_KEY = "test-inbound-key"
    call_command("seed_email_templates", verbosity=0)
    validator = _enqueue_schema()
    payload = {
        "kind": "rapports.cr_steps_missing",
        "to": ["formateur@filiale.example.com"],
        "locale": "fr",
        "module_url": "https://academy.example/portail/compte-rendu/nouveau?session=s1",
        "context": {
            "display_name": "Jean Dupont",
            "brand": "TOYOTA",
            "session_code": "TS04-G3",
            "level": "G3",
            "training_title": "Révision des organes châssis",
            "session_date": "19 au 23 janvier 2026",
            "country": "Togo",
            "missing_pages": "Résultats, Photos",
        },
    }
    assert list(validator.iter_errors(payload)) == []
    client = APIClient()
    accepted = client.post(
        "/api/v1/mail/messages/enqueue",
        payload,
        format="json",
        HTTP_X_MAIL_SERVICE_KEY="test-inbound-key",
    )
    assert accepted.status_code == 201
    refused = {**payload, "locale": "de"}
    assert list(validator.iter_errors(refused))
    rejected = client.post(
        "/api/v1/mail/messages/enqueue",
        refused,
        format="json",
        HTTP_X_MAIL_SERVICE_KEY="test-inbound-key",
    )
    assert rejected.status_code == 400
    assert "detail" in rejected.json()
    unknown = client.post(
        "/api/v1/mail/messages/enqueue",
        {**payload, "inconnu": True},
        format="json",
        HTTP_X_MAIL_SERVICE_KEY="test-inbound-key",
    )
    assert unknown.status_code == 400
    assert "inconnu" in unknown.json()["detail"]
