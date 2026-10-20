"""TDD D inc.2 — inscription + progression : scopée (équipe) + règle self (apprenant)."""
import pytest
from rest_framework.test import APIClient

from core.auth.principal import Principal
from lms.models import Course, Enrollment

URL = "/api/v1/core/lms/enrollments/"


def _learner():
    return Principal(id="u_kouame", roles=["learner"], attr={"scopeNodes": ["groupe.cmr.douala"]})


@pytest.fixture
def course(db):
    return Course.objects.create(title="Moteur Diesel HINO", brand="HINO", level="junior", published=True)


def test_enrollment_anonyme_refuse():
    assert APIClient().get(URL).status_code in (401, 403)


@pytest.mark.django_db
def test_self_enroll(monkeypatch, course):
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: True)
    c = APIClient(); c.force_authenticate(_learner())
    r = c.post(URL, {"course": str(course.id)}, format="json")
    assert r.status_code == 201
    e = Enrollment.objects.get()
    assert e.learner_sub == "u_kouame" and e.status == "assigned"


@pytest.mark.django_db
def test_list_self_filtre(monkeypatch, course):
    monkeypatch.setattr("lms.views.cerbos.plan", lambda *a, **k: {"kind": "KIND_ALWAYS_ALLOWED"})
    Enrollment.objects.create(learner_sub="u_kouame", course=course, org_path=["groupe", "groupe.cmr"])
    c = APIClient(); c.force_authenticate(_learner())
    r = c.get(URL)
    assert r.status_code == 200 and len(r.json()["results"]) == 1


@pytest.mark.django_db
def test_list_vide_si_plan_denied(monkeypatch, course):
    monkeypatch.setattr("lms.views.cerbos.plan", lambda *a, **k: {"kind": "KIND_ALWAYS_DENIED"})
    Enrollment.objects.create(learner_sub="u_kouame", course=course, org_path=["groupe"])
    c = APIClient(); c.force_authenticate(_learner())
    assert c.get(URL).json()["results"] == []


@pytest.mark.django_db
def test_progress_update(monkeypatch, course):
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: True)
    e = Enrollment.objects.create(learner_sub="u_kouame", course=course, org_path=["groupe", "groupe.cmr"])
    c = APIClient(); c.force_authenticate(_learner())
    r = c.patch(f"{URL}{e.id}/", {"progress_pct": 60, "status": "in_progress"}, format="json")
    assert r.status_code == 200
    e.refresh_from_db()
    assert e.progress_pct == 60 and e.status == "in_progress"


@pytest.mark.django_db
def test_retrieve_hors_scope_refuse(monkeypatch, course):
    # Voir l'inscription d'un autre, hors périmètre → 403 (négatif)
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: False)
    e = Enrollment.objects.create(learner_sub="autre", course=course, org_path=["groupe", "groupe.civ"])
    c = APIClient(); c.force_authenticate(_learner())
    assert c.get(f"{URL}{e.id}/").status_code == 403
