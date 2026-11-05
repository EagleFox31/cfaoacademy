"""TDD 12-3 — catalogue des rôles système (lecture, réservé superadmin / admin groupe)."""
import pytest
from rest_framework.test import APIClient

from core.auth.principal import Principal

URL = "/api/v1/core/roles"


def test_roles_anonyme_refuse():
    assert APIClient().get(URL).status_code in (401, 403)


@pytest.mark.django_db
def test_roles_superadmin_ok(monkeypatch):
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: True)
    c = APIClient(); c.force_authenticate(Principal(id="s", roles=["superadmin"], attr={}))
    r = c.get(URL)
    assert r.status_code == 200
    assert len(r.json()) == 22
    assert any(x["code"] == "learner" for x in r.json())


@pytest.mark.django_db
def test_roles_learner_refuse(monkeypatch):
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: False)
    c = APIClient(); c.force_authenticate(Principal(id="l", roles=["learner"], attr={}))
    assert c.get(URL).status_code == 403
