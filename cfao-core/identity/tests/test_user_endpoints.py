"""TDD B inc.4 — endpoints /users scopés (via scope_paths dénormalisé) + négatifs."""
import pytest
from rest_framework.test import APIClient

from core.auth.principal import Principal
from identity.models import OrgUnit, RoleAssignment, User

URL = "/api/v1/core/users/"


def _admin():
    return Principal(
        id="adm", roles=["branch_admin"],
        attr={"scopeNode": "groupe.cmr", "orgPath": ["groupe", "groupe.cmr"]},
    )


@pytest.fixture
def data(db):
    grp = OrgUnit.objects.create(kind="group", slug="groupe", name="G")
    cmr = OrgUnit.objects.create(kind="branch", slug="cmr", name="CMR", parent=grp)
    civ = OrgUnit.objects.create(kind="branch", slug="civ", name="CIV", parent=grp)
    u_cmr = User.objects.create(keycloak_sub="s-cmr", email="a@x.io")
    RoleAssignment.objects.create(user=u_cmr, role="learner", scope_unit=cmr)
    u_cmr.recompute_scope_paths()
    u_civ = User.objects.create(keycloak_sub="s-civ", email="b@x.io")
    RoleAssignment.objects.create(user=u_civ, role="learner", scope_unit=civ)
    u_civ.recompute_scope_paths()
    return u_cmr, u_civ


@pytest.mark.django_db
def test_recompute_scope_paths_union(data):
    u_cmr, _ = data
    assert u_cmr.scope_paths == ["groupe", "groupe.cmr"]


def test_list_anonyme_refuse():
    assert APIClient().get(URL).status_code in (401, 403)


@pytest.mark.django_db
def test_list_plan_allowed(monkeypatch, data):
    monkeypatch.setattr("identity.views.cerbos.plan", lambda *a, **k: {"kind": "KIND_ALWAYS_ALLOWED"})
    c = APIClient(); c.force_authenticate(_admin())
    r = c.get(URL)
    assert r.status_code == 200 and len(r.json()["results"]) == 2


@pytest.mark.django_db
def test_list_plan_denied_vide(monkeypatch, data):
    monkeypatch.setattr("identity.views.cerbos.plan", lambda *a, **k: {"kind": "KIND_ALWAYS_DENIED"})
    c = APIClient(); c.force_authenticate(_admin())
    r = c.get(URL)
    assert r.status_code == 200 and r.json()["results"] == []


@pytest.mark.django_db
def test_retrieve_hors_scope_refuse(monkeypatch, data):
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: False)
    _, u_civ = data
    c = APIClient(); c.force_authenticate(_admin())
    assert c.get(f"{URL}{u_civ.id}/").status_code == 403


@pytest.mark.django_db
def test_create_non_admin_refuse(monkeypatch, data):
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: False)
    c = APIClient(); c.force_authenticate(Principal(id="u", roles=["learner"], attr={}))
    r = c.post(URL, {"keycloak_sub": "x", "email": "z@x.io"}, format="json")
    assert r.status_code == 403
