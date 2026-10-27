from __future__ import annotations

from urllib.parse import urlparse

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator, validate_email
from django.db import IntegrityError, transaction

from outbound.catalog import BY_KEY, Audience, Mode, is_internal_recipient
from outbound.models import OutboundMessage


class ForbiddenSend(Exception):
    pass


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
) -> tuple[OutboundMessage, bool]:
    if correlation_id:
        existing = (
            OutboundMessage.objects.filter(correlation_id=correlation_id)
            .exclude(status=OutboundMessage.Status.REJECTED)
            .first()
        )
        if existing:
            return existing, False

    message_type = BY_KEY.get(kind)
    if message_type is None:
        raise ForbiddenSend(f"Type de message inconnu : {kind}")

    recipients = [address for address in (to or []) if address]
    copies = [address for address in (cc or []) if address]
    if not recipients:
        raise ForbiddenSend(f"Aucun destinataire pour « {kind} ».")

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

    try:
        with transaction.atomic():
            message = OutboundMessage.objects.create(
                kind=kind,
                status=status,
                source_app=source_app or "",
                source_ref=source_ref or "",
                correlation_id=correlation_id or None,
                to=recipients,
                cc=copies,
                reply_to=header_reply,
                locale=locale,
                context=payload,
            )
    except IntegrityError:
        existing = (
            OutboundMessage.objects.filter(correlation_id=correlation_id)
            .exclude(status=OutboundMessage.Status.REJECTED)
            .first()
        )
        if existing is None:
            raise
        return existing, False
    return message, True
