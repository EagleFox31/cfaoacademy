import json
from datetime import datetime, timedelta, timezone

import pytest
import responses
from django.core.management import call_command

from supervision.collectors import activity, docker_client
from supervision.models import ContainerEvent, KnownUser, UserModuleAccess

pytestmark = pytest.mark.django_db
KC = "http://keycloak.invalid/auth"


def line(module="needs", sub="u-1", status=200, azp="cfao-portail-web", time="2026-11-19T10:00:00+01:00", **extra):
    entry = {"time": time, "module": module, "status": status, "sub": sub, "client": "", "remote": "10.0.0.1"}
    if azp is not None:
        entry["azp"] = azp
    entry.update(extra)
    return json.dumps(entry)


@pytest.fixture
def referential():
    call_command("bootstrap")


def test_lecture_d_une_ligne_de_la_passerelle(referential):
    edge_map, clients = activity.edge_module_map(), set(activity.client_module_map())
    subject, module, at = activity.parse_edge_line(line(), edge_map, clients)
    assert (subject, module.project, at.hour) == ("u-1", "cfao-needs", 10)
    assert activity.parse_edge_line(line(sub=""), edge_map, clients) is None  # sonde, page publique
    assert activity.parse_edge_line(line(status=401), edge_map, clients) is None
    assert activity.parse_edge_line(line(module="inconnu"), edge_map, clients) is None
    assert activity.parse_edge_line(line(azp="cfao-supervision-collector"), edge_map, clients) is None
    assert activity.parse_edge_line("2026/11/19 notice nginx", edge_map, clients) is None


def test_activite_garde_la_date_la_plus_recente_et_aucune_ip(referential, monkeypatch):
    lines = [line(time="2026-11-19T10:00:00+01:00"), line(time="2026-11-19T11:00:00+01:00"),
             line(module="planning", time="2026-11-19T09:00:00+01:00")]
    monkeypatch.setattr(docker_client, "edge_logs", lambda since: lines)
    activity.collect_edge(now_s=datetime(2026, 11, 19, 12, tzinfo=timezone.utc).timestamp())
    access = UserModuleAccess.objects.get(module__project="cfao-needs")
    assert access.last_activity_at.hour == 10  # 11 h à Douala = 10 h UTC
    assert UserModuleAccess.objects.count() == 2
    # Rejouer la même période : aucune écriture.
    monkeypatch.setattr(docker_client, "edge_logs", lambda since: lines[:1])
    assert activity.collect_edge()["written"] == 0
    assert "10.0.0.1" not in str(list(UserModuleAccess.objects.values())) + str(list(KnownUser.objects.values()))


@responses.activate
def test_connexions_keycloak_donnent_le_nom_du_compte(referential, settings):
    settings.KEYCLOAK_INTERNAL_URL = KC
    now_ms = int(datetime(2026, 11, 19, 12, tzinfo=timezone.utc).timestamp() * 1000)
    responses.post(f"{KC}/realms/cfao/protocol/openid-connect/token", json={"access_token": "t"})
    responses.get(f"{KC}/admin/realms/cfao/events", json=[
        {"time": now_ms, "type": "LOGIN", "clientId": "cfao-needs-web", "userId": "u-1",
         "ipAddress": "10.9.9.9", "details": {"username": "jdupont"}},
        {"time": now_ms - 1000, "type": "LOGIN", "clientId": "account-console", "userId": "u-2",
         "details": {"username": "autre"}},
    ])
    result = activity.collect_keycloak(now_s=now_ms / 1000)
    assert result["events"] == 2
    assert KnownUser.objects.get(subject="u-1").username == "jdupont"
    access = UserModuleAccess.objects.get()
    assert (access.user.subject, access.module.project) == ("u-1", "cfao-needs")
    assert "10.9.9.9" not in str(list(KnownUser.objects.values()))
    # Le curseur avance : la même page relue ne compte plus rien.
    assert activity.collect_keycloak(now_s=now_ms / 1000)["events"] == 0
    token_call = responses.calls[0].request
    assert "grant_type=client_credentials" in token_call.body


def test_keycloak_non_configure_ne_fait_rien(settings):
    settings.KEYCLOAK_COLLECTOR_SECRET = ""
    assert "skipped" in activity.collect_keycloak()


def test_retention(referential):
    old = datetime.now(timezone.utc) - timedelta(days=200)
    user = KnownUser.objects.create(subject="ancien", username="ancien", last_seen_at=old)
    from supervision.models import Module
    UserModuleAccess.objects.create(user=user, module=Module.objects.first(), last_login_at=old)
    fresh = KnownUser.objects.create(subject="recent", last_seen_at=datetime.now(timezone.utc))
    UserModuleAccess.objects.create(user=fresh, module=Module.objects.first(), last_activity_at=fresh.last_seen_at)
    result = activity.purge()
    assert result["accesses"] == 1 and result["users"] == 1
    assert list(KnownUser.objects.values_list("subject", flat=True)) == ["recent"]
    assert ContainerEvent.objects.count() == 0
