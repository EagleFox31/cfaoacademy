"""TDD 12-4 — journal d'audit : enregistrement, lecture scopée, read-only, intégration affectation."""
import pytest
from rest_framework.test import APIClient

from audit.models import AuditEvent
from audit.services import record_audit
from core.auth.principal import Principal

URL = "/api/v1/core/audit/"


def _admin():
    return Principal(id="adm", roles=["branch_admin"], attr={"scopeNodes": ["groupe.cmr"]})


@pytest.mark.django_db
def test_record_audit_cree_evenement():
    ev = record_audit(actor=Principal(id="adm", roles=["branch_admin"], attr={}),
                      action="assignment.create", resource_kind="role_assignment",
                      resource_id="x", org_path=["groupe", "groupe.cmr"], metadata={"role": "ki"})
    assert ev.actor_sub == "adm" and ev.action == "assignment.create"
    assert AuditEvent.objects.count() == 1


def test_audit_anonyme_refuse():
    assert APIClient().get(URL).status_code in (401, 403)


@pytest.mark.django_db
def test_audit_liste_scopee_allowed(monkeypatch):
    monkeypatch.setattr("audit.views.cerbos.plan", lambda *a, **k: {"kind": "KIND_ALWAYS_ALLOWED"})
    record_audit(actor=_admin(), action="a", resource_kind="k", org_path=["groupe"])
    c = APIClient(); c.force_authenticate(_admin())
    r = c.get(URL)
    assert r.status_code == 200 and len(r.json()["results"]) == 1


@pytest.mark.django_db
def test_audit_liste_vide_si_denied(monkeypatch):
    monkeypatch.setattr("audit.views.cerbos.plan", lambda *a, **k: {"kind": "KIND_ALWAYS_DENIED"})
    record_audit(actor=_admin(), action="a", resource_kind="k", org_path=["groupe"])
    c = APIClient(); c.force_authenticate(_admin())
    r = c.get(URL)
    assert r.status_code == 200 and r.json()["results"] == []


@pytest.mark.django_db
def test_audit_lecture_seule(monkeypatch):
    # Pas d'écriture via l'API (journal append-only). DRF vérifie la permission avant la
    # méthode : `create` sur audit_log n'a aucune règle → refus. 403 (ou 405) = non-écrivable.
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: False)
    c = APIClient(); c.force_authenticate(_admin())
    assert c.post(URL, {}, format="json").status_code in (403, 405)


@pytest.mark.django_db
def test_affectation_enregistre_audit(monkeypatch):
    # Intégration : créer une affectation laisse une trace d'audit.
    monkeypatch.setattr("identity.views.cerbos.check", lambda *a, **k: True)
    from identity.models import OrgUnit, User
    grp = OrgUnit.objects.create(kind="group", slug="groupe", name="G")
    cmr = OrgUnit.objects.create(kind="branch", slug="cmr", name="CMR", parent=grp)
    u = User.objects.create(keycloak_sub="s1", email="u@x.io")
    c = APIClient(); c.force_authenticate(_admin())
    c.post(f"/api/v1/core/users/{u.id}/assignments/", {"role": "ki", "scope_unit": str(cmr.id)}, format="json")
    assert AuditEvent.objects.filter(action="assignment.create").count() == 1
