"""Contrat fournisseur : needs-analytics (contracts/registry.json).

La copie publiée doit être le document généré, et les vraies réponses du
serveur doivent respecter ce document.
"""

import json

import pytest
from jsonschema import Draft202012Validator
from rest_framework.test import APIClient

from analytics.contract import CONTRACT_PATH, CONTRACT_VERSION, openapi_document, publish, render

KEY = "contract-test-key"


def _validator(path: str, status: int, method: str = "get") -> Draft202012Validator:
    document = openapi_document()
    schema = document["paths"][path][method]["responses"][str(status)]["content"]["application/json"]["schema"]
    bundled = {**schema, "$defs": document["components"]["schemas"]}
    return Draft202012Validator(json.loads(json.dumps(bundled).replace("#/components/schemas/", "#/$defs/")))


def test_published_contract_is_generated():
    assert CONTRACT_PATH.read_bytes().decode("utf-8") == render()
    assert render() == render()
    assert openapi_document()["info"]["version"] == CONTRACT_VERSION


def test_publish_writes_only_on_drift(tmp_path):
    target = tmp_path / "contract" / "spec.json"
    assert publish(target) is True
    written = target.stat().st_mtime_ns
    assert publish(target) is False
    assert target.stat().st_mtime_ns == written
    target.write_text("{}", encoding="utf-8")
    assert publish(target) is True
    assert target.read_bytes().decode("utf-8") == render()


def test_contract_endpoint_serves_the_file():
    response = APIClient().get("/api/v1/needs/analytics/contract")
    assert response.status_code == 200
    assert response.json() == openapi_document()


PATHS = sorted(path for path, operations in openapi_document()["paths"].items() if "get" in operations)
YEAR_PATHS = [p for p in PATHS if "400" in openapi_document()["paths"][p]["get"]["responses"]]


@pytest.mark.django_db
@pytest.mark.parametrize("path", PATHS)
def test_server_success_matches_published_contract(settings, path):
    settings.ANALYTICS_INBOUND_KEY = KEY
    ok = APIClient().get(path, {"year": 2026}, HTTP_X_ANALYTICS_KEY=KEY)
    assert ok.status_code == 200
    assert list(_validator(path, 200).iter_errors(ok.json())) == []


@pytest.mark.django_db
@pytest.mark.parametrize("path", YEAR_PATHS)
def test_server_errors_match_published_contract(settings, path):
    settings.ANALYTICS_INBOUND_KEY = KEY
    client = APIClient()

    refused = client.get(path, HTTP_X_ANALYTICS_KEY="wrong")
    assert refused.status_code == 403
    assert list(_validator(path, 403).iter_errors(refused.json())) == []

    bad_year = client.get(path, {"year": "abc"}, HTTP_X_ANALYTICS_KEY=KEY)
    assert bad_year.status_code == 400
    assert list(_validator(path, 400).iter_errors(bad_year.json())) == []
