"""Contrat consommateur : cfao-planning -> needs-analytics (contracts/registry.json).

Chaque appel de `planning.clients.needs` est confronté à la spec publiée par
cfao-needs ; la réponse simulée est l'exemple de cette spec. Un champ renommé
côté needs casse ce test au lieu de donner une couverture fausse.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "contracts"))

import kit  # noqa: E402

from planning.clients import needs as client  # noqa: E402
from referential.models import Country, CountryAlias  # noqa: E402
from referential.normalize import norm_key  # noqa: E402

BASE = "http://needs.test"
SPEC = kit.load_spec("needs-analytics")
pytestmark = pytest.mark.django_db


class _Response:
    def __init__(self, payload, status_code=200):
        self.status_code, self._payload = status_code, payload

    def json(self):
        return self._payload


@pytest.fixture
def calls(monkeypatch, settings):
    settings.NEEDS_API_URL = BASE
    settings.NEEDS_ANALYTICS_KEY = "contract-test-key"
    seen = []

    def fake_get(url, params=None, headers=None, timeout=None):
        path = url[len(BASE):]
        assert kit.request_errors(SPEC, path, params, headers) == []
        assert list(kit.response_validator(SPEC, path, 200).iter_errors(kit.response_example(SPEC, path))) == []
        seen.append(path)
        return _Response(kit.response_example(SPEC, path))

    client.reset_refresh_clock()
    monkeypatch.setattr(client.requests, "get", fake_get)
    return seen


def _example(kind: str, pole: str = "motors") -> dict:
    year = kit.response_example(SPEC, client.SNAPSHOT)["years"]["2026"]
    return year[kind] if kind == "catalog_levels" else year[kind][pole]


@pytest.fixture
def benin(referential):
    ben = Country.objects.create(code="ben", label="Bénin", org_path=["cfao", "ben"])
    CountryAlias.objects.create(alias_norm=norm_key("BENIN"), country=ben)
    return ben


def test_besoins_par_pays_et_marque(calls, benin):
    data = client.fetch_needs(2026, "MOTORS")
    example = _example("needs_by_branch_brand")["rows"][0]
    assert data.available and data.source == "quota_import"
    assert data.by_country == {"ben": example["needs"]}
    assert data.by_cell[("ben", "toyota")] == (example["needs"], example["technicians"])
    assert data.postponed == {("ben", "toyota", client.norm_code("TS11-G2")): 3}
    assert calls == [client.SNAPSHOT]


def test_libelle_inconnu_signale_jamais_compte(calls, referential):
    data = client.fetch_needs(2026, "MOTORS")
    assert data.by_country == {}
    assert data.warnings == [{"code": "unknown_country", "value": "BENIN"}]


def test_thematiques_non_choisies(calls):
    data = client.fetch_unchosen(2026, "MOTORS")
    example = _example("unchosen_modules")
    assert data["available"] and data["modules"] == example["modules"]


def test_niveaux_du_catalogue(calls):
    assert client.fetch_catalog_levels(2026).available is True
    assert calls == [client.SNAPSHOT]


def test_ecriture_du_niveau(monkeypatch, settings):
    settings.NEEDS_API_URL, settings.NEEDS_CATALOG_WRITE_KEY = BASE, "write-key"

    def fake_post(url, json=None, headers=None, timeout=None):
        path = url[len(BASE):]
        assert kit.request_errors(SPEC, path, None, headers, method="post") == []
        return _Response(kit.response_example(SPEC, path, method="post"))

    monkeypatch.setattr(client.requests, "post", fake_post)
    assert client.update_catalog_level(("a",), "G4", "G3")["changed"] is True


def test_needs_injoignable(monkeypatch, settings, db):
    settings.NEEDS_API_URL, settings.NEEDS_ANALYTICS_KEY = BASE, "k"
    client.reset_refresh_clock()
    monkeypatch.setattr(client.requests, "get", lambda *a, **k: _Response({}, 503))
    data = client.fetch_needs(2026, "MOTORS")
    assert not data.available and data.warnings == [{"code": "needs_unavailable"}]


def test_sans_configuration_aucun_appel(settings, db):
    settings.NEEDS_API_URL = ""
    assert client.fetch_needs(2026, "MOTORS").available is False
