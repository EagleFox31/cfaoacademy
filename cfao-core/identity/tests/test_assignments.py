"""TDD B inc.5 — /users/{id}/assignments + recompute auto (signal) + négatifs."""
import pytest
from rest_framework.test import APIClient

from core.auth.principal import Principal
from identity.models import OrgUnit, RoleAssignment, User


def _admin():
    return Principal(id="adm", roles=["branch_admin"],
                     attr={"scopeNode": "groupe.cmr", "orgPath": ["groupe", "groupe.cmr"]})


@pytest.fixture
def base(db):
    grp = OrgUnit.objects.create(kind="group", slug="groupe", name="G")
    cmr = OrgUnit.objects.create(kind="branch", slug="cmr", name="CMR", parent=grp)
    u = User.objects.create(keycloak_sub="s1", email="u@x.io")
    return grp, cmr, u


def _url(u):
    return f"/api/v1/core/users/{u.id}/assignments/"


@pytest.mark.django_db
def test_signal_recompute_auto(base):
    _, cmr, u = base
    assert u.scope_paths == []
    ra = RoleAssignment.objects.create(user=u, role="learner", scope_unit=cmr)
    u.refresh_from_db()
    assert u.scope_paths == ["groupe", "groupe.cmr"]  # recompute auto à la création
    ra.delete()
    u.refresh_from_db()
    assert u.scope_paths == []  # recompute auto à la suppression


@pytest.mark.django_db
def test_post_assignment_in_scope(monkeypatch, base):
    monkeypatch.setattr("identity.views.cerbos.check", lambda *a, **k: True)
    _, cmr, u = base
    c = APIClient(); c.force_authenticate(_admin())
    r = c.post(_url(u), {"role": "learner", "scope_unit": str(cmr.id)}, format="json")
    assert r.status_code == 201
    u.refresh_from_db()
    assert u.scope_paths == ["groupe", "groupe.cmr"]


@pytest.mark.django_db
def test_post_assignment_hors_scope_refuse(monkeypatch, base):
    # Cerbos DENY (admin hors du périmètre de l'affectation visée) → 403 (négatif)
    monkeypatch.setattr("identity.views.cerbos.check", lambda *a, **k: False)
    _, cmr, u = base
    c = APIClient(); c.force_authenticate(_admin())
    r = c.post(_url(u), {"role": "learner", "scope_unit": str(cmr.id)}, format="json")
    assert r.status_code == 403


@pytest.mark.django_db
def test_get_assignments(monkeypatch, base):
    monkeypatch.setattr("identity.views.cerbos.check", lambda *a, **k: True)
    _, cmr, u = base
    RoleAssignment.objects.create(user=u, role="ki", scope_unit=cmr)
    c = APIClient(); c.force_authenticate(_admin())
    r = c.get(_url(u))
    assert r.status_code == 200 and len(r.json()) == 1


@pytest.mark.django_db
def test_delete_assignment_in_scope(monkeypatch, base):
    # DELETE /assignments/{id} — autorisé dans le périmètre → 204 + recompute auto (signal)
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: True)
    _, cmr, u = base
    ra = RoleAssignment.objects.create(user=u, role="learner", scope_unit=cmr)
    u.refresh_from_db(); assert u.scope_paths != []
    c = APIClient(); c.force_authenticate(_admin())
    r = c.delete(f"/api/v1/core/assignments/{ra.id}/")
    assert r.status_code == 204
    u.refresh_from_db(); assert u.scope_paths == []  # signal recompute après suppression


@pytest.mark.django_db
def test_delete_assignment_hors_scope_refuse(monkeypatch, base):
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: False)
    _, cmr, u = base
    ra = RoleAssignment.objects.create(user=u, role="learner", scope_unit=cmr)
    c = APIClient(); c.force_authenticate(_admin())
    r = c.delete(f"/api/v1/core/assignments/{ra.id}/")
    assert r.status_code == 403
