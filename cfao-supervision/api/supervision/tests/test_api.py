import json
from datetime import datetime, timedelta, timezone

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from supervision.collectors import docker_client, docker_collector
from supervision.models import KnownUser, Module, UserModuleAccess

from .conftest import client_for, inspect_of, summary

pytestmark = pytest.mark.django_db
BASE = "/api/v1/supervision"
PRIVATE = ("docker_id", "image_id", "sha256:", "u-1", "10.0.0.1", "ne-doit-jamais-sortir")


@pytest.fixture
def world(monkeypatch):
    """Needs en ligne (2 conteneurs), edge arrêté ; une connexion connue."""
    call_command("bootstrap")
    monkeypatch.setattr(docker_client, "list_containers", lambda: [
        summary("cfao-needs", "needs-api", status="Up (healthy)", image="antifragile237/cfao-needs-api:1.4.0",
                labels={"org.cfao.changelog": "## 1.4.0\n- Export Excel",
                        "org.cfao.contracts.provides": "needs-analytics@1.5.0"},
                ports=[{"IP": "127.0.0.1", "PrivatePort": 8000, "PublicPort": 8092, "Type": "tcp"}]),
        summary("cfao-needs", "needs-migrate", state="exited", status="Exited (0)"),
        summary("cfao-edge", "edge", state="exited", status="Exited (137)",
                labels={"org.cfao.contracts.consumes": "needs-analytics@^1,mail-outbound@^0.2"}),
    ])
    monkeypatch.setattr(docker_client, "inspect", lambda cid: inspect_of(
        "exited" if "edge" in cid or "migrate" in cid else "running",
        exit_code=137 if "edge" in cid else 0, finished="2026-11-19T07:00:00Z"))
    docker_collector.collect()
    user = KnownUser.objects.create(subject="u-1", username="jdupont")
    UserModuleAccess.objects.create(user=user, module=Module.objects.get(project="cfao-needs"),
                                    last_login_at=datetime.now(timezone.utc) - timedelta(minutes=5))


def test_sans_jeton_refuse():
    assert APIClient().get(f"{BASE}/overview").status_code in (401, 403)


def test_sonde_de_vie_publique():
    assert APIClient().get(f"{BASE}/healthz").json()["status"] == "ok"


@pytest.mark.parametrize("path", ["overview", "dependencies", "connections", "modules/cfao-needs",
                                  "modules/cfao-needs/history"])
def test_formateur_refuse_partout(world, trainer, path):
    assert trainer.get(f"{BASE}/{path}").status_code == 403


def test_droits_annonces_au_portail(fake_pdp):
    assert client_for("platform_ops").get(f"{BASE}/access").json() == {"board": True, "connections": True}
    assert client_for("trainer").get(f"{BASE}/access").json() == {"board": False, "connections": False}


def test_vue_d_ensemble(world, ops):
    body = ops.get(f"{BASE}/overview").json()
    modules = {m["project"]: m for m in body["modules"]}
    assert modules["cfao-needs"]["status"] == "ok"  # le job migrate terminé en 0 ne compte pas comme panne
    assert modules["cfao-needs"]["version"] == "1.4.0"
    assert modules["cfao-needs"]["ports"] == [8092]
    assert modules["cfao-needs"]["last_connection"]["user"] == "jdupont"
    assert modules["cfao-edge"]["status"] == "down"
    assert modules["cfao-edge"]["since"].startswith("2026-11-19T07:00")
    assert body["counts"]["down"] == 1 and body["counts"]["ok"] == 1
    assert body["stale"] is True  # aucune collecte enregistrée par la boucle
    assert not any(secret in json.dumps(body) for secret in PRIVATE)


def test_detail_d_un_module(world, ops):
    body = ops.get(f"{BASE}/modules/cfao-needs").json()
    assert body["changelog"].startswith("## 1.4.0")
    services = {c["service"]: c for c in body["container_list"]}
    assert services["needs-migrate"]["status"] == "done"
    assert services["needs-api"]["provides"] == {"needs-analytics": "1.5.0"}
    assert body["connections"][0]["user"] == "jdupont"
    assert not any(secret in json.dumps(body) for secret in PRIVATE)
    assert ops.get(f"{BASE}/modules/inconnu").status_code == 404


def test_dependances(world, ops, monkeypatch):
    # Edge relancé : ses besoins en API sont lus sur les conteneurs qui tournent.
    monkeypatch.setattr(docker_client, "inspect", lambda cid: inspect_of())
    monkeypatch.setattr(docker_client, "list_containers", lambda: [
        summary("cfao-needs", "needs-api", labels={"org.cfao.contracts.provides": "needs-analytics@1.5.0"}),
        summary("cfao-edge", "edge", labels={"org.cfao.contracts.consumes": "needs-analytics@^1,mail-outbound@^0.2"}),
    ])
    docker_collector.collect()
    links = {link["contract"]: link for link in ops.get(f"{BASE}/dependencies").json()["links"]}
    assert links["needs-analytics"]["status"] == "ok"
    assert links["needs-analytics"]["provider"] == "cfao-needs"
    assert links["mail-outbound"]["status"] == "missing"


def test_connexions_compte_non_identifie(world, ops):
    KnownUser.objects.create(subject="u-2")
    UserModuleAccess.objects.create(user_id="u-2", module=Module.objects.get(project="cfao-needs"),
                                    last_activity_at=datetime.now(timezone.utc))
    rows = ops.get(f"{BASE}/connections").json()["connections"]
    assert [row["user"] for row in rows] == [None, "jdupont"]
    assert "u-2" not in json.dumps(rows)


def test_projet_surveille_jamais_vu_est_en_panne(world, ops, settings):
    settings.SUPERVISION_PROJECTS = ["cfao-needs", "cfao-edge", "cfao-absent"]
    modules = {m["project"]: m for m in ops.get(f"{BASE}/overview").json()["modules"]}
    assert modules["cfao-absent"]["status"] == "down"
