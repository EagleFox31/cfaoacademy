"""Messages de Keycloak : code de connexion, liens d'action, alerte support."""
import json
import re
from datetime import timedelta

import pytest
from django.core.management import call_command
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from outbound.catalog import BY_KEY, LOCALES, MESSAGE_TYPES
from outbound.contract import CONTRACT_PATH, render
from outbound.models import EmailTemplate, OutboundMessage
from outbound.services.backends import LocMemBackend
from outbound.services.render import MASK

IDENTITY_KEY = "test-identity-key"
CODE = "482913"
LINK = "https://academy.example/auth/realms/cfao/login-actions/action-token?key=SECRETTOKEN42"
LINK_KINDS = ("identity.password_reset", "identity.execute_actions", "identity.verify_email")


@pytest.fixture(autouse=True)
def _templates(db):
    call_command("seed_email_templates", verbosity=0)
    LocMemBackend.outbox.clear()
    yield
    LocMemBackend.outbox.clear()


def _post(payload, key=IDENTITY_KEY):
    return APIClient().post(
        "/api/v1/mail/messages/enqueue", payload, format="json", HTTP_X_MAIL_SERVICE_KEY=key,
    )


def _login_code(**extra):
    payload = {
        "kind": "identity.login_code",
        "to": ["technicien@filiale.example.com"],
        "expires_at": (timezone.now() + timedelta(minutes=30)).isoformat(),
        "module_url": LINK,
        "context": {"display_name": "Awa", "code": CODE, "code_minutes": 10, "link_minutes": 30},
    }
    payload.update(extra)
    return payload


def _sql_dump() -> str:
    connection.ensure_connection()
    return "\n".join(connection.connection.iterdump())


def _preheader(html: str) -> str:
    return re.search(r'mso-hide:all;">(.*?)&#847;', html, re.S).group(1)


# ── Catalogue et gabarits ────────────────────────────────────────────────────

def test_identity_links_are_secrets_and_reserved_to_keycloak():
    for message_type in MESSAGE_TYPES:
        if not message_type.key.startswith("identity."):
            continue
        assert message_type.allowed_sources == ("cfao-identity",)
        if message_type.sensitive:
            assert "module_url" in message_type.secret_context


def test_every_kind_has_a_template_per_locale_and_seed_is_idempotent():
    for message_type in MESSAGE_TYPES:
        for locale in LOCALES:
            assert EmailTemplate.objects.filter(key=message_type.subject_key, locale=locale).exists()
    before = EmailTemplate.objects.count()
    call_command("seed_email_templates", verbosity=0)
    assert EmailTemplate.objects.count() == before


def test_seed_never_overwrites_an_edited_template():
    EmailTemplate.objects.filter(key="identity.login_code", locale="fr").update(subject="Revu en prod")
    call_command("seed_email_templates", verbosity=0)
    assert EmailTemplate.objects.get(key="identity.login_code", locale="fr").subject == "Revu en prod"


def test_sensitive_subjects_never_reference_a_secret():
    for message_type in MESSAGE_TYPES:
        if not message_type.sensitive:
            continue
        for template in EmailTemplate.objects.filter(key=message_type.subject_key):
            for secret in message_type.secret_context + ("code_display",):
                assert f"${secret}" not in template.subject, (template, secret)


# ── Code de connexion ───────────────────────────────────────────────────────

@pytest.mark.parametrize("locale, hello", [("fr", "Bonjour Awa"), ("en", "Hello Awa"), ("pt", "Olá Awa")])
def test_login_code_mail_shows_code_and_button_but_stores_neither(locale, hello):
    response = _post(_login_code(locale=locale, correlation_id=f"identity:login:{locale}"))
    assert response.status_code == 201, response.json()

    sent = LocMemBackend.outbox[0]
    assert sent["text"].startswith(hello)
    assert "482 913" in sent["text"] and LINK in sent["text"]
    assert "482 913</td>" in sent["html"]  # bloc du code
    assert "Courier New" in sent["html"]
    assert f'href="{LINK}"' in sent["html"]
    # Écran verrouillé : ni l'objet ni l'aperçu ne livrent le code.
    for visible in (sent["subject"], _preheader(sent["html"])):
        assert CODE not in visible.replace(" ", "") and MASK not in visible

    message = OutboundMessage.objects.get()
    assert message.status == OutboundMessage.Status.SENT
    stored = message.rendered_subject + message.rendered_text + message.rendered_html
    assert "482 913" not in stored and "SECRETTOKEN42" not in stored
    assert f"{MASK}</td>" in message.rendered_html  # le bloc du code reste lisible, masqué
    dump = _sql_dump()
    assert CODE not in dump and "482 913" not in dump and "SECRETTOKEN42" not in dump


def test_subject_edited_with_a_secret_still_hides_it():
    EmailTemplate.objects.filter(key="identity.login_code", locale="fr").update(subject="Code $code_display $code")
    assert _post(_login_code()).status_code == 201
    sent = LocMemBackend.outbox[0]
    assert CODE not in sent["subject"].replace(" ", "")
    assert CODE not in _preheader(sent["html"]).replace(" ", "")


def test_button_sits_where_the_link_is_in_the_template():
    assert _post(_login_code()).status_code == 201
    html = LocMemBackend.outbox[0]["html"]
    assert html.index("482 913") < html.index(f'href="{LINK}"') < html.index("Ignorez ce mail")
    assert html.count("SECRETTOKEN42") == 2  # bouton VML Outlook + lien des autres clients, pas de ligne nue


def test_producer_preheader_is_ignored_on_sensitive_messages():
    payload = _login_code()
    payload["context"]["preheader"] = f"Votre code {CODE}"
    assert _post(payload).status_code == 201
    assert CODE not in _preheader(LocMemBackend.outbox[0]["html"])


@pytest.mark.parametrize(
    "field, value",
    [("code", "48291"), ("code", "48291a"), ("code", "4829134"), ("code_minutes", "0"), ("link_minutes", "dix")],
)
def test_malformed_fields_are_refused_without_echoing_the_value(field, value):
    payload = _login_code()
    payload["context"][field] = value
    response = _post(payload)
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert field in detail and value not in detail
    assert OutboundMessage.objects.count() == 0


def test_link_host_must_be_allowed():
    response = _post(_login_code(module_url="https://phishing.example/auth?key=x"))
    assert response.status_code == 400
    assert OutboundMessage.objects.count() == 0


# ── Liens d'action Keycloak ─────────────────────────────────────────────────

@pytest.mark.parametrize("kind", LINK_KINDS)
def test_action_link_is_sent_once_and_never_stored(kind):
    response = _post(
        {
            "kind": kind,
            "to": ["technicien@filiale.example.com"],
            "locale": "pt",
            "expires_at": (timezone.now() + timedelta(minutes=30)).isoformat(),
            "context": {"display_name": "Awa", "module_url": LINK, "link_minutes": 30},
        },
    )
    assert response.status_code == 201, response.json()
    sent = LocMemBackend.outbox[0]
    assert f'href="{LINK}"' in sent["html"]
    assert "30 minutos" in sent["text"]
    message = OutboundMessage.objects.get()
    assert "SECRETTOKEN42" not in message.rendered_html + message.rendered_text
    assert "SECRETTOKEN42" not in _sql_dump()


@pytest.mark.parametrize("kind", ("identity.login_code",) + LINK_KINDS + ("identity.login_support_alert",))
def test_shared_key_cannot_send_identity_messages(kind):
    payload = _login_code(kind=kind)
    assert _post(payload, key="test-inbound-key").status_code == 403
    assert OutboundMessage.objects.count() == 0


# ── Alerte support ──────────────────────────────────────────────────────────

def _alert(entered="inconnu@filiale.example.com", day="2026-11-16"):
    return {
        "kind": "identity.login_support_alert",
        "to": ["support@cfao.com"],
        "reply_to": entered if "\n" not in entered else "",
        "correlation_id": f"identity:support:{day}:{entered}",
        "context": {"entered_email": entered, "request": "Connexion par mail", "problem": "Aucun compte avec cette adresse"},
    }


def test_support_alert_is_sent_once_per_address_and_day():
    first = _post(_alert())
    assert first.status_code == 201, first.json()
    sent = LocMemBackend.outbox[0]
    assert "inconnu@filiale.example.com" in sent["subject"]
    assert sent["reply_to"] == "inconnu@filiale.example.com"
    again = _post(_alert())
    assert again.status_code == 200 and again.json()["created"] is False
    assert _post(_alert(day="2026-11-17")).status_code == 201
    assert len(LocMemBackend.outbox) == 2


def test_support_alert_to_an_outside_address_waits_for_review():
    payload = {**_alert(), "to": ["support@externe.example.com"]}
    assert _post(payload).status_code == 201
    assert OutboundMessage.objects.get().status == OutboundMessage.Status.PENDING_REVIEW
    assert LocMemBackend.outbox == []


@pytest.mark.parametrize("entered", ["sans-arobase", "a@b\nBcc: x@y.example", "a b@c.example"])
def test_support_alert_refuses_a_malformed_entered_address(entered):
    response = _post(_alert(entered=entered))
    assert response.status_code == 400
    assert OutboundMessage.objects.count() == 0


# ── Contrat ─────────────────────────────────────────────────────────────────

def test_published_contract_is_byte_identical():
    assert CONTRACT_PATH.read_bytes() == render().encode("utf-8")
    document = json.loads(render())
    assert document["info"]["version"] == "0.2.0"
    assert "EXPIRED" in document["components"]["schemas"]["OutboundMessage"]["properties"]["status"]["enum"]


def _validator():
    from jsonschema import Draft202012Validator, FormatChecker

    document = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    raw = document["paths"]["/api/v1/mail/messages/enqueue"]["post"]["requestBody"]["content"]["application/json"]["schema"]
    bundled = json.loads(json.dumps({"oneOf": raw["oneOf"], "$defs": document["components"]["schemas"]}).replace(
        "#/components/schemas/", "#/$defs/",
    ))
    return Draft202012Validator(bundled, format_checker=FormatChecker())


@pytest.mark.parametrize(
    "change, accepted",
    [
        ({}, True),
        ({"locale": "pt"}, True),
        ({"cc": ["chef@filiale.example.com"]}, False),
        ({"expires_at": None}, False),
        ({"context": {"display_name": "Awa", "code": "48291", "code_minutes": 10, "link_minutes": 30}}, False),
        ({"locale": "de"}, False),
    ],
)
def test_contract_and_server_agree_on_login_code(change, accepted):
    payload = _login_code(**change)
    if payload.get("expires_at") is None:
        payload.pop("expires_at")
    assert (not list(_validator().iter_errors(payload))) is accepted
    status = _post(payload).status_code
    assert (status == 201) is accepted, status


def test_contract_declares_secrets_and_sources():
    schemas = json.loads(render())["components"]["schemas"]
    login = schemas["EnqueueIdentityLoginCode"]
    assert login["x-secret-context"] == ["code", "module_url"]
    assert login["x-allowed-sources"] == ["cfao-identity"]
    assert "cc" not in login["properties"] and "expires_at" in login["required"]
    assert login["properties"]["context"]["properties"]["code"]["pattern"] == "^[0-9]{6}$"
    assert "x-secret-context" not in schemas["EnqueueOpsTicketResolved"]
    assert set(BY_KEY) >= {"identity.login_code", *LINK_KINDS, "identity.login_support_alert"}
