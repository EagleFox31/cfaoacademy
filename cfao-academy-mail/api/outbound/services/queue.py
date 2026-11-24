from __future__ import annotations

import re
from datetime import datetime, timedelta
from urllib.parse import urlparse

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator, validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone

from outbound.catalog import BY_KEY, Audience, Mode, is_internal_recipient
from outbound.models import OutboundMessage
from outbound.services.sealing import SealingUnavailable, seal


class ForbiddenSend(Exception):
    pass


class ForbiddenSource(ForbiddenSend):
    """La clé service n'a pas le droit d'envoyer ce type (réponse 403)."""


def _present(value) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


def validate_module_url(destination: str) -> None:
    """Valide l'adresse du bouton, qu'elle vienne du champ ou du contexte."""
    schemes = ["http", "https"] if settings.DEBUG else ["https"]
    try:
        URLValidator(schemes=schemes)(destination)
    except ValidationError as exc:
        raise ForbiddenSend("module_url invalide.") from exc
    allowed = [host.lower().strip() for host in getattr(settings, "MAIL_ALLOWED_LINK_HOSTS", []) if host.strip()]
    if not allowed:
        # Default-deny hors DEBUG : sans liste, le hub signerait un lien vers n'importe quel site.
        if settings.DEBUG:
            return
        raise ForbiddenSend("module_url : MAIL_ALLOWED_LINK_HOSTS n'est pas configuré.")
    host = (urlparse(destination).hostname or "").lower()
    if host not in allowed:
        raise ForbiddenSend(f"module_url : hôte « {host} » non autorisé.")


def validate_reply_to(value: str) -> None:
    if any(char in value for char in "\r\n\x00"):
        raise ForbiddenSend("reply_to invalide.")
    try:
        validate_email(value)
    except ValidationError as exc:
        raise ForbiddenSend("reply_to invalide.") from exc


def _check_source(message_type, bound_source: str | None, source_app: str) -> str:
    """Source effective du message. Une clé liée impose la sienne."""
    if bound_source and source_app and source_app != bound_source:
        raise ForbiddenSource("source_app ne correspond pas à la clé service.")
    effective = bound_source or source_app or ""
    if message_type.allowed_sources and bound_source not in message_type.allowed_sources:
        raise ForbiddenSource(f"« {message_type.key} » n'est pas autorisé pour cette clé service.")
    return effective


def _check_expiry(message_type, expires_at: datetime | None) -> None:
    if not message_type.sensitive:
        if expires_at is not None:
            raise ForbiddenSend(f"expires_at n'est accepté que pour un message sensible (« {message_type.key} »).")
        return
    if expires_at is None:
        raise ForbiddenSend(f"expires_at est obligatoire pour « {message_type.key} ».")
    now = timezone.now()
    if expires_at <= now:
        raise ForbiddenSend("expires_at est déjà passé.")
    if expires_at > now + timedelta(minutes=settings.MAIL_SENSITIVE_MAX_TTL_MINUTES):
        raise ForbiddenSend("expires_at dépasse la durée maximale d'un message sensible.")


def _existing(correlation_id: str | None, source: str) -> OutboundMessage | None:
    if not correlation_id:
        return None
    existing = (
        OutboundMessage.objects.filter(correlation_id=correlation_id)
        .exclude(status=OutboundMessage.Status.REJECTED)
        .first()
    )
    if existing is None:
        return None
    existing_type = BY_KEY.get(existing.kind)
    if existing_type and existing_type.sensitive and existing.source_app != source:
        # Un correlation_id deviné ne donne rien sur le message d'un autre producteur.
        raise ForbiddenSource("correlation_id déjà utilisé par une autre source.")
    return existing


def enqueue(
    kind: str,
    to: list[str],
    *,
    cc: list[str] | None = None,
    reply_to: str = "",
    module_url: str = "",
    locale: str = "fr",
    context: dict | None = None,
    source_app: str = "",
    source_ref: str = "",
    correlation_id: str | None = None,
    expires_at: datetime | None = None,
    bound_source: str | None = None,
) -> tuple[OutboundMessage, bool]:
    message_type = BY_KEY.get(kind)
    if message_type is None:
        raise ForbiddenSend(f"Type de message inconnu : {kind}")
    source_app = _check_source(message_type, bound_source, source_app)

    existing = _existing(correlation_id, source_app)
    if existing:
        return existing, False

    _check_expiry(message_type, expires_at)

    recipients = [address for address in (to or []) if address]
    copies = [address for address in (cc or []) if address]
    if not recipients:
        raise ForbiddenSend(f"Aucun destinataire pour « {kind} ».")
    if message_type.sensitive and copies:
        raise ForbiddenSend(f"Copie interdite pour un message sensible (« {kind} »).")

    internal_domains = settings.ACADEMY_INTERNAL_DOMAINS
    all_internal = all(
        is_internal_recipient(address, internal_domains) for address in recipients + copies
    )

    auto = False
    if message_type.mode == Mode.TRANSACTIONAL:
        auto = True
    elif message_type.mode == Mode.AUTO:
        auto = (
            message_type.audience == Audience.INTERNAL
            and all_internal
        )
    if message_type.mode == Mode.AUTO and message_type.audience == Audience.EXTERNAL:
        raise ForbiddenSend(f"Configuration invalide pour « {kind} ».")

    status = (
        OutboundMessage.Status.APPROVED if auto else OutboundMessage.Status.PENDING_REVIEW
    )

    payload = dict(context or {})
    header_reply = (reply_to or payload.pop("reply_to", "") or "").strip()
    # L'adresse du bouton vient du module. Le hub n'invente pas d'hôte ni de chemin.
    destination = (module_url or payload.get("module_url") or "").strip()
    if destination:
        validate_module_url(destination)
        payload["module_url"] = destination
    else:
        payload.pop("module_url", None)
    if header_reply:
        validate_reply_to(header_reply)

    missing = [
        key for key in message_type.required_context
        if not _present(destination if key == "module_url" else payload.get(key))
    ]
    if missing:
        raise ForbiddenSend(
            f"Champs requis manquants pour « {kind} » : {', '.join(missing)}."
        )
    # La valeur n'est jamais citée : ce peut être un secret.
    malformed = [
        field for field, pattern in message_type.context_patterns
        if not re.fullmatch(pattern, str(payload.get(field, "")).strip())
    ]
    if malformed:
        raise ForbiddenSend(f"Format invalide pour « {kind} » : {', '.join(malformed)}.")

    sealed = None
    if message_type.sensitive:
        # Les secrets sortent du contexte avant toute écriture : seul le chiffré est stocké.
        secrets = {key: str(payload.pop(key)) for key in message_type.secret_context if key in payload}
        try:
            sealed = seal(secrets)
        except SealingUnavailable as exc:
            raise ForbiddenSend(str(exc)) from exc

    try:
        with transaction.atomic():
            message = OutboundMessage.objects.create(
                kind=kind,
                status=status,
                source_app=source_app,
                source_ref=source_ref or "",
                correlation_id=correlation_id or None,
                to=recipients,
                cc=copies,
                reply_to=header_reply,
                locale=locale,
                context=payload,
                sealed_context=sealed,
                expires_at=expires_at if message_type.sensitive else None,
            )
    except IntegrityError:
        existing = _existing(correlation_id, source_app)
        if existing is None:
            raise
        return existing, False
    return message, True
