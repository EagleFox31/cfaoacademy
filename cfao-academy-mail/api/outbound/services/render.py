from __future__ import annotations

import string
from html import escape

from django.conf import settings

from outbound.catalog import BY_KEY
from outbound.models import EmailTemplate, OutboundMessage
from outbound.services.layout import (
    formation_sentence_html,
    formation_sentence_text,
    paragraphs_from_text,
    shell_html,
)


class MissingTranslation(Exception):
    pass


CIVILITY_FR = {"M": "Monsieur", "MME": "Madame", "NEUTRE": ""}
CIVILITY_EN = {"M": "Mr", "MME": "Ms", "NEUTRE": ""}


def greeting(civility: str, name: str, locale: str) -> str:
    table = CIVILITY_EN if locale.startswith("en") else CIVILITY_FR
    hello = "Hello" if locale.startswith("en") else "Bonjour"
    title = table.get(civility or "NEUTRE", "")
    who = f"{title} {name}".strip() if title else (name or "").strip()
    if who:
        return f"{hello} {who}"
    return hello


def resolve_template(key: str, locale: str) -> EmailTemplate:
    template = (
        EmailTemplate.objects.filter(key=key, locale=locale, is_active=True)
        .order_by("-version")
        .first()
    )
    if template:
        return template
    raise MissingTranslation(f"Aucun template pour « {key} » / « {locale} ».")


def render_message(message: OutboundMessage) -> OutboundMessage:
    message_type = BY_KEY.get(message.kind)
    if message_type is None:
        raise MissingTranslation(f"Type inconnu : {message.kind}")

    template = resolve_template(message_type.subject_key, message.locale)
    context = _flatten(message.context)
    context.setdefault(
        "greeting",
        greeting(context.get("civility", ""), context.get("display_name", ""), message.locale),
    )

    message.template = template
    message.template_version = template.version
    message.rendered_subject = f"{settings.EMAIL_SUBJECT_PREFIX} {_fill(template.subject, context)}".strip()
    message.rendered_text = _text(template, context, message.locale)
    message.rendered_html = _html(template, message.rendered_text, context, message.locale, message.kind)
    message.save(
        update_fields=[
            "template", "template_version", "rendered_subject",
            "rendered_text", "rendered_html", "updated_at",
        ],
    )
    return message


def _text(template: EmailTemplate, context: dict, locale: str) -> str:
    sentence = formation_sentence_text(context, locale)
    if not sentence:
        return _fill(template.body_text, context)
    url = context.get("module_url", "")
    lines = [f"{context.get('greeting', 'Bonjour')},", "", sentence]
    if url:
        lines.extend(["", url])
    return "\n".join(lines) + "\n"


def _kicker(kind: str, context: dict) -> str:
    if context.get("kicker"):
        return context["kicker"]
    if kind.startswith("rapports."):
        return "CFAO ACADEMY : COMPTE RENDUS DE FORMATIONS"
    return "CFAO ACADEMY"


def _html(template: EmailTemplate, text: str, context: dict, locale: str, kind: str) -> str:
    if template.body_html:
        return _fill(template.body_html, context)
    url = context.get("module_url", "")
    label = context.get("cta_label") or ("Open" if locale.startswith("en") else "Ouvrir")
    sentence = formation_sentence_html(context, locale)
    html_paragraphs = None
    if sentence:
        html_paragraphs = [f"{escape(context.get('greeting', 'Bonjour'))},", sentence]
    return shell_html(
        title=_fill(template.subject, context),
        paragraphs=paragraphs_from_text(text, url),
        html_paragraphs=html_paragraphs,
        cta_url=url,
        cta_label=label if url else "",
        locale=locale,
        preheader=context.get("preheader", "") or formation_sentence_text(context, locale),
        kicker=_kicker(kind, context),
    )


def _fill(text: str, context: dict) -> str:
    return string.Template(text).safe_substitute(context)


def _flatten(context: dict, prefix: str = "") -> dict:
    flat: dict[str, str] = {}
    for key, value in (context or {}).items():
        name = f"{prefix}{key}"
        if isinstance(value, dict):
            flat.update(_flatten(value, f"{name}_"))
        elif isinstance(value, (list, tuple)):
            flat[name] = ", ".join(str(v) for v in value)
        else:
            flat[name] = "" if value is None else str(value)
    return flat
