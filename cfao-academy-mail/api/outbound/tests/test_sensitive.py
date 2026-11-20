"""Messages sensibles : aucun secret en clair en base, envoi unique, expiration."""
from datetime import timedelta

import pytest
from django.core.management import call_command
from django.db import connection
from django.utils import timezone
from django_q.models import Schedule
from rest_framework.test import APIClient

from outbound import catalog
from outbound.catalog import Audience, MessageType, Mode, UnsafeAutoSend, assert_catalog_is_safe
from outbound.models import EmailSendLog, EmailTemplate, OutboundMessage
from outbound.services import sender as sender_module
from outbound.services.backends import LocMemBackend
from outbound.services.queue import ForbiddenSend, ForbiddenSource, enqueue
from outbound.services.render import MASK
from outbound.services.sender import NotResendable, _claim_secrets, expire_sensitive, send_message
from outbound.tasks import dispatch_message

KIND = "identity.test_code"
CODE = "482913"
LINK = "https://academy.example/auth/realms/cfao/login-actions/action-token?key=SECRETTOKEN42"
IDENTITY_KEY = "test-identity-key"

SENSITIVE = MessageType(
    key=KIND,
    audience=Audience.EXTERNAL,
    mode=Mode.TRANSACTIONAL,
    subject_key=KIND,
    description="Code de connexion (test).",
    required_context=("display_name", "code", "module_url"),
    sensitive=True,
    secret_context=("code", "module_url"),
    allowed_sources=("cfao-identity",),
)


@pytest.fixture(autouse=True)
def _sensitive_type(monkeypatch, db):
    monkeypatch.setitem(catalog.BY_KEY, KIND, SENSITIVE)
    EmailTemplate.objects.create(
        key=KIND, locale="fr", version=1, subject="Votre code de connexion",
        body_text="$greeting,\n\nVotre code : $code\n\n$module_url\n",
    )
    LocMemBackend.outbox.clear()
    yield
    LocMemBackend.outbox.clear()


def _payload(**extra):
    payload = {
        "kind": KIND,
        "to": ["technicien@filiale.example.com"],
        "expires_at": (timezone.now() + timedelta(minutes=10)).isoformat(),
        "context": {"display_name": "Awa", "code": CODE, "module_url": LINK},
    }
    payload.update(extra)
    return payload


def _post(payload, key=IDENTITY_KEY):
    return APIClient().post(
        "/api/v1/mail/messages/enqueue", payload, format="json", HTTP_X_MAIL_SERVICE_KEY=key,
    )


def _sql_dump() -> str:
    connection.ensure_connection()
    return "\n".join(connection.connection.iterdump())


def _queued(**extra) -> OutboundMessage:
    message, _ = enqueue(
        KIND,
        ["technicien@filiale.example.com"],
        context={"display_name": "Awa", "code": CODE, "module_url": LINK},
        expires_at=timezone.now() + timedelta(minutes=10),
        bound_source="cfao-identity",
        **extra,
    )
    return message


# ── Catalogue ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "change, reason",
    [
        ({"mode": Mode.REVIEW}, "TRANSACTIONAL"),
        ({"secret_context": ()}, "sans champ secret"),
        ({"allowed_sources": ()}, "sans source"),
        ({"secret_context": ("code", "otp")}, "hors des champs requis"),
        ({"sensitive": False}, "sans être sensible"),
    ],
)
def test_catalog_refuses_unsafe_sensitive_types(change, reason):
    unsafe = MessageType(**{**SENSITIVE.__dict__, **change})
    with pytest.raises(UnsafeAutoSend, match=reason):
        assert_catalog_is_safe((unsafe,))
    assert_catalog_is_safe((SENSITIVE,))


# ── Parcours complet : aucun secret en clair ─────────────────────────────────

def test_secret_reaches_the_mail_but_never_the_database():
    response = _post(_payload(correlation_id="identity:login:1"))
    assert response.status_code == 201, response.json()
    body = response.json()["message"]
    assert body["source_app"] == "cfao-identity"
    assert "context" not in body

    assert len(LocMemBackend.outbox) == 1
    sent = LocMemBackend.outbox[0]
    assert CODE in sent["text"] and LINK in sent["text"]
    assert CODE not in sent["subject"]

    message = OutboundMessage.objects.get()
    assert message.status == OutboundMessage.Status.SENT
    assert message.sealed_context is None
    assert "code" not in message.context and "module_url" not in message.context
    assert MASK in message.rendered_text
    assert CODE not in message.rendered_text + message.rendered_html + message.rendered_subject

    dump = _sql_dump()
    assert CODE not in dump
    assert "SECRETTOKEN42" not in dump
    assert "Awa" in dump  # le dump lit bien les tables du hub


def test_sealed_context_is_ciphered_before_sending():
    message = _queued()
    assert message.status == OutboundMessage.Status.APPROVED
    assert message.sealed_context
    raw = bytes(message.sealed_context)
    assert CODE.encode() not in raw and b"SECRETTOKEN42" not in raw
    assert CODE not in _sql_dump()


# ── Droits de la clé service ────────────────────────────────────────────────

def test_shared_key_cannot_send_a_sensitive_message():
    response = _post(_payload(), key="test-inbound-key")
    assert response.status_code == 403
    assert OutboundMessage.objects.count() == 0


def test_key_bound_to_another_source_is_refused(settings):
    settings.MAIL_INBOUND_KEYS = {IDENTITY_KEY: "cfao-identity", "rapports-key": "rapports"}
    assert _post(_payload(), key="rapports-key").status_code == 403
    assert OutboundMessage.objects.count() == 0


def test_bound_key_cannot_claim_another_source_app():
    response = _post(_payload(source_app="rapports"))
    assert response.status_code == 403
    assert OutboundMessage.objects.count() == 0


def test_bound_key_sets_source_app_on_ordinary_messages(settings):
    settings.MAIL_INBOUND_KEYS = {"rapports-key": "rapports"}
    call_command("seed_email_templates", verbosity=0)
    response = _post(
        {
            "kind": "ops.ticket_resolved",
            "to": ["agent@filiale.example.com"],
            "context": {"display_name": "Paul"},
        },
        key="rapports-key",
    )
    assert response.status_code == 201
    assert response.json()["message"]["source_app"] == "rapports"


def test_unknown_key_is_refused():
    assert _post(_payload(), key="nope").status_code == 403


def test_correlation_id_of_another_source_is_not_disclosed():
    _queued(correlation_id="identity:login:2")
    with pytest.raises(ForbiddenSource):
        # Type ordinaire, clé commune : seul le correlation_id vise le message sensible.
        enqueue(
            "ops.ticket_resolved", ["x@filiale.example.com"],
            context={"display_name": "X"}, correlation_id="identity:login:2",
        )


# ── Validation à l'entrée ───────────────────────────────────────────────────

@pytest.mark.parametrize(
    "extra, fragment",
    [
        ({"cc": ["chef@filiale.example.com"]}, "Copie interdite"),
        ({"expires_at": None}, "expires_at"),
        ({"expires_at": (timezone.now() - timedelta(minutes=1)).isoformat()}, "déjà passé"),
        ({"expires_at": (timezone.now() + timedelta(days=3)).isoformat()}, "durée maximale"),
    ],
)
def test_invalid_sensitive_payloads_are_refused(extra, fragment):
    payload = _payload(**extra)
    if payload.get("expires_at") is None:
        payload.pop("expires_at")
    response = _post(payload)
    assert response.status_code == 400
    assert fragment in response.json()["detail"]
    assert OutboundMessage.objects.count() == 0


def test_expires_at_is_refused_on_ordinary_messages():
    call_command("seed_email_templates", verbosity=0)
    response = _post(
        {
            "kind": "ops.ticket_resolved",
            "to": ["agent@filiale.example.com"],
            "context": {"display_name": "Paul"},
            "expires_at": (timezone.now() + timedelta(minutes=10)).isoformat(),
        },
        key="test-inbound-key",
    )
    assert response.status_code == 400
    assert "expires_at" in response.json()["detail"]


def test_missing_sealing_key_refuses_sensitive_messages(settings):
    settings.MAIL_SEALED_CONTEXT_KEY = ""
    response = _post(_payload())
    assert response.status_code == 400
    assert "MAIL_SEALED_CONTEXT_KEY" in response.json()["detail"]
    assert OutboundMessage.objects.count() == 0


# ── Envoi unique, expiration, échec ─────────────────────────────────────────

def test_sent_sensitive_message_cannot_be_resent():
    message = _queued()
    log = send_message(message)
    message.refresh_from_db()
    assert message.status == OutboundMessage.Status.SENT
    with pytest.raises(NotResendable):
        send_message(message)
    with pytest.raises(NotResendable):
        send_message(message, resent_from=log)
    assert len(LocMemBackend.outbox) == 1


def test_resend_is_refused_even_before_the_first_send():
    first = _queued()
    log = send_message(first)
    pending = _queued()
    with pytest.raises(NotResendable):
        send_message(pending, resent_from=log)
    pending.refresh_from_db()
    assert pending.status == OutboundMessage.Status.APPROVED and pending.sealed_context
    assert len(LocMemBackend.outbox) == 1


def test_concurrent_dispatch_sends_once():
    message = _queued()
    _claim_secrets(OutboundMessage.objects.get(pk=message.pk))  # une première exécution a pris les secrets
    dispatch_message(str(message.pk))  # la seconde ne fait rien
    assert LocMemBackend.outbox == []


def test_expired_message_is_not_sent():
    message = _queued()
    OutboundMessage.objects.filter(pk=message.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
    message.refresh_from_db()
    assert send_message(message) is None
    message.refresh_from_db()
    assert message.status == OutboundMessage.Status.EXPIRED
    assert message.sealed_context is None
    assert LocMemBackend.outbox == []
    assert EmailSendLog.objects.count() == 0


def test_backend_failure_wipes_secrets_and_keeps_no_content(monkeypatch):
    class Boom:
        def send(self, **kwargs):
            raise RuntimeError(f"550 rejected: {kwargs['text']}")

    monkeypatch.setattr(sender_module, "get_backend", lambda: Boom())
    message = _queued()
    log = send_message(message)
    message.refresh_from_db()
    assert message.status == OutboundMessage.Status.FAILED
    assert message.sealed_context is None
    assert log.error == "RuntimeError"
    assert CODE not in _sql_dump()


def test_unreadable_seal_fails_without_sending(settings):
    message = _queued()
    settings.MAIL_SEALED_CONTEXT_KEY = "b3RoZXIta2V5LW90aGVyLWtleS1vdGhlci1rZXktMzI="
    assert send_message(message) is None
    message.refresh_from_db()
    assert message.status == OutboundMessage.Status.FAILED
    assert LocMemBackend.outbox == []


def test_purge_expires_and_is_idempotent():
    due = _queued()
    fresh = _queued()
    OutboundMessage.objects.filter(pk=due.pk).update(expires_at=timezone.now() - timedelta(minutes=1))
    assert expire_sensitive() == 1
    due.refresh_from_db()
    fresh.refresh_from_db()
    assert due.status == OutboundMessage.Status.EXPIRED and due.sealed_context is None
    assert fresh.status == OutboundMessage.Status.APPROVED and fresh.sealed_context
    before = OutboundMessage.objects.get(pk=due.pk).updated_at
    assert expire_sensitive() == 0
    assert OutboundMessage.objects.get(pk=due.pk).updated_at == before


def test_purge_schedule_is_created_once_and_never_overwritten():
    call_command("ensure_mail_schedules", verbosity=0)
    schedule = Schedule.objects.get(name="mail.purge_sensitive_messages")
    assert schedule.func == "outbound.tasks.purge_sensitive_messages"
    Schedule.objects.filter(pk=schedule.pk).update(minutes=15)  # réglage revu en prod
    call_command("ensure_mail_schedules", verbosity=0)
    assert Schedule.objects.count() == 1
    assert Schedule.objects.get(pk=schedule.pk).minutes == 15


def test_ordinary_queue_is_untouched_by_the_purge():
    with pytest.raises(ForbiddenSend):
        enqueue("inconnu.kind", ["a@b.example"])
    assert expire_sensitive() == 0
