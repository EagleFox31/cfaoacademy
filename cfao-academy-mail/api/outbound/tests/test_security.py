import pytest
from django.core.management import call_command
from django.db import IntegrityError
from django.db.models import QuerySet
from rest_framework.test import APIClient

from outbound.models import OutboundMessage


def _rapport(**extra):
    context = {
        "display_name": "Jean Dupont",
        "brand": "TOYOTA",
        "session_code": "TS04-G3",
        "level": "G3",
        "training_title": "Révision des organes châssis",
        "session_date": "19 au 23 janvier 2026",
        "country": "Togo",
        "missing_pages": "Photos",
    }
    context.update(extra)
    return {
        "kind": "rapports.cr_steps_missing",
        "to": ["formateur@filiale.example.com"],
        "context": context,
    }


@pytest.fixture
def client(settings):
    settings.MAIL_INBOUND_KEY = "test-inbound-key"
    settings.DEBUG = False
    call_command("seed_email_templates", verbosity=0)
    api = APIClient()
    api.credentials(HTTP_X_MAIL_SERVICE_KEY="test-inbound-key")
    return api


@pytest.mark.django_db
@pytest.mark.parametrize("url", ["javascript:alert(1)", "data:text/html,hi", "http://academy.example/x"])
def test_context_module_url_is_rejected(client, url):
    response = client.post("/api/v1/mail/messages/enqueue", _rapport(module_url=url), format="json")
    assert response.status_code == 400
    assert "module_url" in response.json()["detail"]
    assert OutboundMessage.objects.count() == 0


@pytest.mark.django_db
def test_module_url_host_must_be_allowlisted(client, settings):
    settings.MAIL_ALLOWED_LINK_HOSTS = ["academy.cfao.com"]
    response = client.post(
        "/api/v1/mail/messages/enqueue",
        _rapport(module_url="https://evil.example/phish"),
        format="json",
    )
    assert response.status_code == 400
    assert "hôte" in response.json()["detail"]


@pytest.mark.django_db
def test_empty_allowlist_rejects_links_outside_debug(client, settings):
    settings.MAIL_ALLOWED_LINK_HOSTS = []
    response = client.post(
        "/api/v1/mail/messages/enqueue",
        _rapport(module_url="https://academy.example/portail/compte-rendu/nouveau?session=s1"),
        format="json",
    )
    assert response.status_code == 400
    assert "MAIL_ALLOWED_LINK_HOSTS" in response.json()["detail"]
    assert OutboundMessage.objects.count() == 0


@pytest.mark.django_db
def test_public_base_url_host_is_allowed_without_list(client, settings):
    settings.MAIL_ALLOWED_LINK_HOSTS = []
    settings.PUBLIC_BASE_URL = "https://plateforme.example"
    ok = client.post("/api/v1/mail/messages/enqueue", _rapport(module_url="https://plateforme.example/x"), format="json")
    ko = client.post("/api/v1/mail/messages/enqueue", _rapport(module_url="https://evil.example/x"), format="json")
    assert ok.status_code == 201
    assert ko.status_code == 400


@pytest.mark.django_db
def test_http_allowed_only_for_exact_http_public_origin(client, settings):
    settings.MAIL_ALLOWED_LINK_HOSTS = ["academy.example"]
    settings.PUBLIC_BASE_URL = "http://10.0.0.5:8080"

    def post(url):
        return client.post("/api/v1/mail/messages/enqueue", _rapport(module_url=url), format="json").status_code

    assert post("http://10.0.0.5:8080/portail") == 201
    assert post("http://10.0.0.5:9999/portail") == 400  # autre port
    assert post("http://10.0.0.5/portail") == 400  # port implicite différent
    assert post("http://academy.example/portail") == 400  # extra : https seulement


@pytest.mark.django_db
def test_https_public_origin_does_not_open_http(client, settings):
    settings.PUBLIC_BASE_URL = "https://plateforme.example"
    response = client.post(
        "/api/v1/mail/messages/enqueue", _rapport(module_url="http://plateforme.example/x"), format="json"
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_https_module_url_is_accepted(client):
    response = client.post(
        "/api/v1/mail/messages/enqueue",
        _rapport(module_url="https://academy.example/portail/compte-rendu/nouveau?session=s1"),
        format="json",
    )
    assert response.status_code == 201


@pytest.mark.django_db
@pytest.mark.parametrize("reply_to", ["pas-un-email", "a@b.com\nBcc: x@y.com"])
def test_context_reply_to_is_rejected(client, reply_to):
    response = client.post(
        "/api/v1/mail/messages/enqueue",
        _rapport(
            module_url="https://academy.example/portail/compte-rendu/nouveau?session=s1",
            reply_to=reply_to,
        ),
        format="json",
    )
    assert response.status_code == 400
    assert "reply_to" in response.json()["detail"]
    assert OutboundMessage.objects.count() == 0


@pytest.mark.django_db
def test_active_correlation_id_is_unique():
    OutboundMessage.objects.create(
        kind="rapports.cr_steps_missing",
        status=OutboundMessage.Status.APPROVED,
        correlation_id="meme-id",
        to=["a@b.com"],
    )
    with pytest.raises(IntegrityError):
        OutboundMessage.objects.create(
            kind="rapports.cr_steps_missing",
            status=OutboundMessage.Status.APPROVED,
            correlation_id="meme-id",
            to=["a@b.com"],
        )


@pytest.mark.django_db
def test_concurrent_correlation_id_returns_existing(client, monkeypatch):
    """Course : la lecture préalable ne voit rien, l'insert bute sur la contrainte."""
    existing = OutboundMessage.objects.create(
        kind="rapports.cr_steps_missing",
        status=OutboundMessage.Status.APPROVED,
        correlation_id="course",
        to=["formateur@filiale.example.com"],
    )
    real_first = QuerySet.first
    calls = {"n": 0}

    def first_blind_once(self):
        calls["n"] += 1
        return None if calls["n"] == 1 else real_first(self)

    monkeypatch.setattr(QuerySet, "first", first_blind_once)
    payload = _rapport(module_url="https://academy.example/portail/compte-rendu/nouveau?session=s1")
    response = client.post(
        "/api/v1/mail/messages/enqueue",
        {**payload, "correlation_id": "course"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["message"]["id"] == str(existing.id)
    assert OutboundMessage.objects.filter(correlation_id="course").count() == 1
