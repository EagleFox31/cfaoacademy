"""TDD B inc.2 — endpoints /org/units scopés + tests NÉGATIFS d'autorisation."""
import pytest
from rest_framework.test import APIClient

from core.auth.principal import Principal
from identity.models import OrgUnit

URL = "/api/v1/core/org/units/"


def _admin():
    return Principal(
        id="a1",
        roles=["branch_admin"],
        attr={"scopeNode": "groupe.cmr", "scopeNodes": ["groupe.cmr"], "orgPath": ["groupe", "groupe.cmr"]},
    )


@pytest.fixture
def tree(db):
    grp = OrgUnit.objects.create(kind="group", slug="groupe", name="G")
    cmr = OrgUnit.objects.create(kind="branch", slug="cmr", name="CMR", parent=grp)
    civ = OrgUnit.objects.create(kind="branch", slug="civ", name="CIV", parent=grp)
    return grp, cmr, civ


def test_list_anonyme_refuse():
    assert APIClient().get(URL).status_code in (401, 403)


@pytest.mark.django_db
def test_list_filtre_par_query_plan_allowed(monkeypatch, tree):
    monkeypatch.setattr("identity.views.cerbos.plan", lambda *a, **k: {"kind": "KIND_ALWAYS_ALLOWED"})
    c = APIClient(); c.force_authenticate(_admin())
    r = c.get(URL)
    assert r.status_code == 200
    assert len(r.json()["results"]) == 3


@pytest.mark.django_db
def test_list_vide_si_plan_denied(monkeypatch, tree):
    monkeypatch.setattr("identity.views.cerbos.plan", lambda *a, **k: {"kind": "KIND_ALWAYS_DENIED"})
    c = APIClient(); c.force_authenticate(_admin())
    r = c.get(URL)
    assert r.status_code == 200
    assert r.json()["results"] == []


@pytest.mark.django_db
def test_retrieve_in_scope_ok(monkeypatch, tree):
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: True)
    _, cmr, _ = tree
    c = APIClient(); c.force_authenticate(_admin())
    assert c.get(f"{URL}{cmr.id}/").status_code == 200


@pytest.mark.django_db
def test_retrieve_hors_scope_refuse(monkeypatch, tree):
    # PEP objet : Cerbos DENY → 403 (négatif)
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: False)
    _, _, civ = tree
    c = APIClient(); c.force_authenticate(_admin())
    assert c.get(f"{URL}{civ.id}/").status_code == 403


@pytest.mark.django_db
def test_create_non_admin_refuse(monkeypatch, tree):
    # Un learner ne peut pas créer d'unité org (négatif / élévation de privilège)
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: False)
    grp, _, _ = tree
    c = APIClient(); c.force_authenticate(Principal(id="u", roles=["learner"], attr={}))
    r = c.post(URL, {"kind": "agency", "slug": "x", "name": "X", "parent": str(grp.id)}, format="json")
    assert r.status_code == 403
