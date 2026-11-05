"""Rendu figé d'un message.

Le rendu est calculé **au moment de la préparation**, pas à l'envoi : ce que le
relecteur voit dans l'écran « À envoyer » est exactement ce qui partira. Un
template modifié entre-temps ne réécrit pas le message déjà relu.
"""
from __future__ import annotations

import string

from django.conf import settings

from outbound.catalog import BY_KEY
from outbound.models import EmailTemplate, OutboundMessage


class MissingTranslation(Exception):
    """Aucun template pour ce couple (clé, locale) — erreur de CI, pas repli silencieux."""


CIVILITY_FR = {"M": "Monsieur", "MME": "Madame", "NEUTRE": ""}
CIVILITY_EN = {"M": "Mr", "MME": "Ms", "NEUTRE": ""}


def greeting(civility: str, name: str, locale: str) -> str:
    """Civilité neutre par défaut : on n'invente jamais le genre de quelqu'un."""
    table = CIVILITY_EN if locale.startswith("en") else CIVILITY_FR
    title = table.get(civility or "NEUTRE", "")
    if title:
        return f"{title} {name}".strip()
    return name or ("Hello" if locale.startswith("en") else "Bonjour")


def resolve_template(key: str, locale: str) -> EmailTemplate:
    template = (
        EmailTemplate.objects.filter(key=key, locale=locale, is_active=True)
        .order_by("-version")
        .first()
    )
    if template:
        return template
    raise MissingTranslation(
        f"Aucun template actif pour « {key} » en « {locale} ». "
        f"Toute clé doit exister dans les deux locales."
    )


def render_message(message: OutboundMessage) -> OutboundMessage:
    message_type = BY_KEY.get(message.kind)
    if message_type is None:
        raise MissingTranslation(f"Type de message inconnu : {message.kind}")

    template = resolve_template(message_type.subject_key, message.locale)
    context = _flatten(message.context)
    context.setdefault(
        "greeting",
        greeting(context.get("civility", ""), context.get("display_name", ""), message.locale),
    )

    message.template = template
    message.template_version = template.version
    message.rendered_subject = f"{settings.EMAIL_SUBJECT_PREFIX} {_fill(template.subject, context)}".strip()
    message.rendered_text = _fill(template.body_text, context)
    message.rendered_html = _fill(template.body_html, context) if template.body_html else ""
    message.save(
        update_fields=[
            "template", "template_version", "rendered_subject",
            "rendered_text", "rendered_html", "updated_at",
        ]
    )
    return message


def _fill(text: str, context: dict) -> str:
    """Substitution tolérante : un placeholder absent laisse une trace visible
    plutôt que de faire échouer l'envoi silencieusement."""
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
