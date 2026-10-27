import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from outbound.models import EmailSendLog, OutboundMessage
from outbound.services.backends import LocMemBackend


@pytest.fixture(autouse=True)
def _clear_outbox():
    LocMemBackend.outbox.clear()
    yield
    LocMemBackend.outbox.clear()


@pytest.mark.django_db
def test_enqueue_transactional_rapports(settings):
    settings.MAIL_INBOUND_KEY = "test-inbound-key"
    call_command("seed_email_templates", verbosity=0)

    client = APIClient()
    response = client.post(
        "/api/v1/mail/messages/enqueue",
        {
            "kind": "rapports.cr_steps_missing",
            "source_app": "rapports",
            "correlation_id": "rapports:abc:steps",
            "to": ["formateur@filiale.example.com"],
            "locale": "fr",
            "context": {
                "display_name": "Jean Dupont",
                "brand": "TOYOTA",
                "session_code": "TS04-G3",
                "level": "G3",
                "training_title": "Révision des organes châssis",
                "session_date": "19 au 23 janvier 2026",
                "country": "Togo",
                "missing_pages": "Résultats, Photos",
                "module_url": "https://academy.example/portail/compte-rendu",
            },
        },
        format="json",
        HTTP_X_MAIL_SERVICE_KEY="test-inbound-key",
    )
    assert response.status_code == 201
    body = response.json()
    assert body["created"] is True
    assert set(body["message"]) >= {
        "id", "kind", "status", "source_app", "correlation_id", "to", "locale",
    }
    assert body["message"]["kind"] == "rapports.cr_steps_missing"
    # La réponse reflète l'état au moment de l'enqueue ; le worker (sync en test) marque SENT.
    stored = OutboundMessage.objects.get(pk=body["message"]["id"])
    assert stored.status == "SENT"
    assert OutboundMessage.objects.count() == 1
    assert EmailSendLog.objects.filter(status="SENT").count() == 1
    assert len(LocMemBackend.outbox) == 1
    assert "TS04-G3" in LocMemBackend.outbox[0]["subject"]
    html = LocMemBackend.outbox[0]["html"]
    assert 'bgcolor="#c8102e"' in html
    assert '<font color="#ffffff"' in html
    assert "display:inline-block;padding:12px 22px" in html
    assert "v:roundrect" in html
    assert 'lang="fr"' in html
    assert "max-width:600px" in html
    assert 'name="color-scheme" content="light"' in html
    assert "mso-hide:all" in html
    assert "https://academy.example/portail/compte-rendu" in html
    assert "Bonjour Jean Dupont," in html
    assert "CFAO ACADEMY : COMPTE RENDUS DE FORMATIONS" in html
    assert "<strong" in html and "TOYOTA" in html and "G3" in html
    assert stored.reply_to == ""
    assert LocMemBackend.outbox[0]["reply_to"] == ""

    dup = client.post(
        "/api/v1/mail/messages/enqueue",
        {
            "kind": "rapports.cr_steps_missing",
            "correlation_id": "rapports:abc:steps",
            "to": ["formateur@filiale.example.com"],
        },
        format="json",
        HTTP_X_MAIL_SERVICE_KEY="test-inbound-key",
    )
    assert dup.status_code == 200
    assert dup.json()["created"] is False
    assert OutboundMessage.objects.count() == 1


@pytest.mark.django_db
def test_enqueue_requires_service_key(settings):
    settings.MAIL_INBOUND_KEY = "test-inbound-key"
    client = APIClient()
    response = client.post(
        "/api/v1/mail/messages/enqueue",
        {"kind": "rapports.cr_to_document", "to": ["a@b.com"]},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_needs_external_stays_pending_review(settings):
    settings.MAIL_INBOUND_KEY = "test-inbound-key"
    call_command("seed_email_templates", verbosity=0)
    client = APIClient()
    response = client.post(
        "/api/v1/mail/messages/enqueue",
        {
            "kind": "needs.submission_confirmed",
            "source_app": "needs",
            "to": ["manager@filiale.example.com"],
            "locale": "fr",
            "context": {"display_name": "Awa"},
        },
        format="json",
        HTTP_X_MAIL_SERVICE_KEY="test-inbound-key",
    )
    assert response.status_code == 201
    assert response.json()["message"]["status"] == "PENDING_REVIEW"
    assert EmailSendLog.objects.count() == 0
    assert LocMemBackend.outbox == []


@pytest.mark.django_db
def test_unknown_kind_is_rejected(settings):
    settings.MAIL_INBOUND_KEY = "test-inbound-key"
    client = APIClient()
    response = client.post(
        "/api/v1/mail/messages/enqueue",
        {"kind": "inconnu.foo", "to": ["a@b.com"]},
        format="json",
        HTTP_X_MAIL_SERVICE_KEY="test-inbound-key",
    )
    assert response.status_code == 400
    assert "inconnu" in response.json()["detail"]


@pytest.mark.django_db
def test_reply_to_comes_from_caller_context(settings):
    settings.MAIL_INBOUND_KEY = "test-inbound-key"
    call_command("seed_email_templates", verbosity=0)
    client = APIClient()
    response = client.post(
        "/api/v1/mail/messages/enqueue",
        {
            "kind": "rapports.cr_to_document",
            "to": ["formateur@filiale.example.com"],
            "context": {
                "display_name": "Jean",
                "reply_to": "referent@cfao.com",
                "pending_count": "2",
                "brand": "TOYOTA",
                "session_code": "TS04-G3",
                "level": "G3",
                "training_title": "Révision des organes châssis",
                "session_date": "19 au 23 janvier 2026",
                "country": "Togo",
                "module_url": "https://cr.example/portail/compte-rendu/a-documenter",
            },
        },
        format="json",
        HTTP_X_MAIL_SERVICE_KEY="test-inbound-key",
    )
    assert response.status_code == 201
    assert response.json()["message"]["reply_to"] == "referent@cfao.com"
    assert LocMemBackend.outbox[0]["reply_to"] == "referent@cfao.com"
    assert "reply_to" not in OutboundMessage.objects.get().context


@pytest.mark.django_db
def test_button_url_comes_from_the_module(settings):
    settings.MAIL_INBOUND_KEY = "test-inbound-key"
    call_command("seed_email_templates", verbosity=0)
    client = APIClient()
    destination = "https://cr.filiale.example/portail/compte-rendu/nouveau?session=s1"
    response = client.post(
        "/api/v1/mail/messages/enqueue",
        {
            "kind": "rapports.cr_steps_missing",
            "to": ["formateur@filiale.example.com"],
            "module_url": destination,
            "context": {
                "display_name": "Jean",
                "brand": "TOYOTA",
                "session_code": "TS04-G3",
                "level": "G3",
                "training_title": "Révision des organes châssis",
                "session_date": "19 au 23 janvier 2026",
                "country": "Togo",
                "missing_pages": "Photos",
            },
        },
        format="json",
        HTTP_X_MAIL_SERVICE_KEY="test-inbound-key",
    )
    assert response.status_code == 201
    html = LocMemBackend.outbox[0]["html"]
    assert destination in html
    assert "academy.cfao.com" not in html

    without = client.post(
        "/api/v1/mail/messages/enqueue",
        {
            "kind": "rapports.cr_steps_missing",
            "correlation_id": "sans-lien",
            "to": ["formateur@filiale.example.com"],
            "context": {"display_name": "Jean", "session_code": "TS04-G3"},
        },
        format="json",
        HTTP_X_MAIL_SERVICE_KEY="test-inbound-key",
    )
    assert without.status_code == 400
    assert "module_url" in without.json()["detail"]
    assert len(LocMemBackend.outbox) == 1


@pytest.mark.django_db
def test_healthz_contract():
    client = APIClient()
    response = client.get("/api/v1/mail/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "cfao-academy-mail"}
