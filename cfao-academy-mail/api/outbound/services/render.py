from __future__ import annotations

import string
from dataclasses import dataclass
from html import escape

from django.conf import settings

from outbound.catalog import BY_KEY
from outbound.models import EmailTemplate, OutboundMessage
from outbound.services.layout import (
    code_display,
    formation_sentence_html,
    formation_sentence_text,
    paragraphs_from_text,
    paragraphs_html,
    shell_html,
)


class MissingTranslation(Exception):
    pass


CIVILITY = {
    "fr": {"M": "Monsieur", "MME": "Madame", "NEUTRE": ""},
    "en": {"M": "Mr", "MME": "Ms", "NEUTRE": ""},
    "pt": {"M": "Sr.", "MME": "Sra.", "NEUTRE": ""},
}
HELLO = {"fr": "Bonjour", "en": "Hello", "pt": "Olá"}

# Libellé du bouton par type. Sans entrée : « Ouvrir ».
CTA_LABELS = {
    "identity.login_code": {"fr": "Ouvrir ma session", "en": "Open my session", "pt": "Abrir a minha sessão"},
    "identity.password_reset": {"fr": "Choisir mon mot de passe", "en": "Choose my password", "pt": "Escolher a minha palavra-passe"},
    "identity.execute_actions": {"fr": "Mettre à jour mon compte", "en": "Update my account", "pt": "Atualizar a minha conta"},
    "identity.verify_email": {"fr": "Confirmer mon adresse", "en": "Confirm my address", "pt": "Confirmar o meu endereço"},
}
OPEN = {"fr": "Ouvrir", "en": "Open", "pt": "Abrir"}


def _language(locale: str) -> str:
    code = (locale or "fr")[:2].lower()
    return code if code in HELLO else "fr"


def greeting(civility: str, name: str, locale: str) -> str:
    language = _language(locale)
    hello = HELLO[language]
    title = CIVILITY[language].get(civility or "NEUTRE", "")
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


MASK = "••••••"


@dataclass(frozen=True)
class Rendered:
    subject: str
    text: str
    html: str


def _compose(template: EmailTemplate, context: dict, message: OutboundMessage, masked: dict | None = None) -> Rendered:
    """`masked` : contexte sans secrets, seul utilisé pour l'objet et l'aperçu (visibles écran verrouillé)."""
    context = _derive(context)
    title = _fill(template.subject, _derive(masked) if masked is not None else context)
    text = _text(template, context, message.locale)
    return Rendered(
        subject=f"{settings.EMAIL_SUBJECT_PREFIX} {title}".strip(),
        text=text,
        html=_html(template, text, context, message.locale, message.kind, title, sensitive=masked is not None),
    )


def _derive(context: dict) -> dict:
    if "code" not in context:
        return context
    return {**context, "code_display": code_display(context["code"])}


def render_message(message: OutboundMessage, secrets: dict | None = None) -> Rendered:
    """Rend le message et stocke ce rendu, puis renvoie le rendu à envoyer.

    Message sensible : deux rendus. Celui qui part contient les secrets et n'est
    jamais écrit ; celui qui est stocké (relecture, audit) les remplace par MASK.
    """
    message_type = BY_KEY.get(message.kind)
    if message_type is None:
        raise MissingTranslation(f"Type inconnu : {message.kind}")

    template = resolve_template(message_type.subject_key, message.locale)
    context = _flatten(message.context)
    context.setdefault(
        "greeting",
        greeting(context.get("civility", ""), context.get("display_name", ""), message.locale),
    )

    if message_type.sensitive:
        masked = {**context, **{key: MASK for key in message_type.secret_context}}
        stored = _compose(template, masked, message, masked)
        sent = _compose(template, {**context, **_flatten(secrets or {})}, message, masked)
    else:
        stored = sent = _compose(template, context, message)

    message.template = template
    message.template_version = template.version
    message.rendered_subject = stored.subject
    message.rendered_text = stored.text
    message.rendered_html = stored.html
    message.save(
        update_fields=[
            "template", "template_version", "rendered_subject",
            "rendered_text", "rendered_html", "updated_at",
        ],
    )
    return sent


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


def _html(
    template: EmailTemplate, text: str, context: dict, locale: str, kind: str, title: str, *, sensitive: bool = False,
) -> str:
    if template.body_html:
        return _fill(template.body_html, context)
    url = context.get("module_url", "")
    language = _language(locale)
    label = context.get("cta_label") or CTA_LABELS.get(kind, OPEN).get(language, OPEN[language])
    sentence = formation_sentence_html(context, locale)
    html_paragraphs = None
    after_cta = None
    if sentence:
        html_paragraphs = [f"{escape(context.get('greeting', 'Bonjour'))},", sentence]
    elif url and f"\n{url}\n" in text:
        # Le bouton prend la place de la ligne du lien dans le gabarit.
        before, after = text.split(f"\n{url}\n", 1)
        code = context.get("code_display", "")
        html_paragraphs = paragraphs_html(before, url, code)
        after_cta = paragraphs_html(after, url, code)
    if sensitive:
        # L'aperçu s'affiche sur un écran verrouillé : jamais un secret, jamais un texte du producteur.
        preheader = title
    else:
        preheader = context.get("preheader", "") or formation_sentence_text(context, locale)
    return shell_html(
        title=title,
        paragraphs=paragraphs_from_text(text, url),
        html_paragraphs=html_paragraphs,
        cta_url=url,
        cta_label=label if url else "",
        locale=locale,
        preheader=preheader,
        kicker=_kicker(kind, context),
        html_after_cta=after_cta,
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
