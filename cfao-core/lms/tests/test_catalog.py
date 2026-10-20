"""TDD D inc.1 — catalogue LMS (Course/Module) : lecture globale, écriture rôles contenu."""
import pytest
from rest_framework.test import APIClient

from core.auth.principal import Principal
from lms.models import Course

URL = "/api/v1/core/lms/courses/"


def _learner():
    return Principal(id="l", roles=["learner"], attr={"scopeNodes": ["groupe.cmr.douala"]})


def _editor():
    return Principal(id="e", roles=["content_editor"], attr={"scopeNodes": ["groupe"]})


def test_courses_anonyme_refuse():
    assert APIClient().get(URL).status_code in (401, 403)


@pytest.mark.django_db
def test_courses_liste_pour_tout_authentifie(monkeypatch):
    monkeypatch.setattr("lms.views.cerbos.plan", lambda *a, **k: {"kind": "KIND_ALWAYS_ALLOWED"})
    Course.objects.create(title="Moteur Diesel HINO", brand="HINO", functional_group="Moteur Diesel", level="junior", published=True)
    c = APIClient(); c.force_authenticate(_learner())
    r = c.get(URL)
    assert r.status_code == 200 and len(r.json()["results"]) == 1


@pytest.mark.django_db
def test_course_create_learner_refuse(monkeypatch):
    # Un apprenant ne crée pas de contenu (négatif).
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: False)
    c = APIClient(); c.force_authenticate(_learner())
    r = c.post(URL, {"title": "X", "level": "junior"}, format="json")
    assert r.status_code == 403


@pytest.mark.django_db
def test_course_create_editor_ok(monkeypatch):
    monkeypatch.setattr("core.authz.permissions.cerbos.check", lambda *a, **k: True)
    c = APIClient(); c.force_authenticate(_editor())
    r = c.post(URL, {"title": "Freinage SINOTRUK", "brand": "SINOTRUK", "functional_group": "Freinage", "level": "senior"}, format="json")
    assert r.status_code == 201
    assert Course.objects.filter(title="Freinage SINOTRUK").exists()
