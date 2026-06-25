"""Tests de l'endpoint de référence /me, dont le test NÉGATIF d'autorisation
(obligatoire dans le gabarit — OWASP A01 / ASVS)."""
import pytest
from rest_framework.test import APIClient

from core.auth.principal import Principal

ME_URL = "/api/v1/core/me"


def _principal(pid="u_123"):
    return Principal(
        id=pid,
        roles=["learner"],
        attr={"scopeNode": "groupe.cmr.douala", "orgPath": ["groupe", "groupe.cmr", "groupe.cmr.douala"]},
    )


@pytest.mark.django_db
def test_me_anonyme_refuse():
    resp = APIClient().get(ME_URL)
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_me_autorise_renvoie_le_principal(monkeypatch):
    # Cerbos autorise.
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: True)
    client = APIClient()
    client.force_authenticate(user=_principal())
    resp = client.get(ME_URL)
    assert resp.status_code == 200
    assert resp.data["id"] == "u_123"
    assert "learner" in resp.data["roles"]


@pytest.mark.django_db
def test_me_refuse_si_cerbos_deny(monkeypatch):
    # Cerbos refuse ⇒ 403 même authentifié (default-deny respecté).
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: False)
    client = APIClient()
    client.force_authenticate(user=_principal())
    resp = client.get(ME_URL)
    assert resp.status_code == 403


@pytest.mark.django_db
def test_me_v2_resolu_depuis_la_base(monkeypatch):
    # Si le compte existe en base, le périmètre vient des affectations (pas du token).
    from identity.models import OrgUnit, RoleAssignment, User
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: True)
    grp = OrgUnit.objects.create(kind="group", slug="groupe", name="G")
    cmr = OrgUnit.objects.create(kind="branch", slug="cmr", name="CMR", parent=grp)
    u = User.objects.create(keycloak_sub="u_123", email="k@x.io")
    RoleAssignment.objects.create(user=u, role="branch_admin", scope_unit=cmr)

    client = APIClient()
    client.force_authenticate(user=_principal())  # token porte roles=["learner"]
    resp = client.get(ME_URL)
    assert resp.status_code == 200
    assert resp.data["source"] == "identity"
    assert resp.data["roles"] == ["branch_admin"]          # la base gagne sur le token
    assert resp.data["scopeNodes"] == ["groupe.cmr"]


@pytest.mark.django_db
def test_me_v2_repli_sur_claims_si_inconnu(monkeypatch):
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: True)
    client = APIClient()
    client.force_authenticate(user=_principal())  # aucun User en base
    resp = client.get(ME_URL)
    assert resp.status_code == 200
    assert resp.data["source"] == "token"
    assert "learner" in resp.data["roles"]
