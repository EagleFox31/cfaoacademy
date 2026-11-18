from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from outbound.catalog import BY_KEY
from outbound.models import EmailSendLog, OutboundMessage

from .backends import get_backend
from .render import Rendered, render_message
from .sealing import SealingUnavailable, unseal


class NotApproved(Exception):
    pass


class NotResendable(Exception):
    """Un message sensible part une seule fois : le producteur en redemande un."""


def _is_sensitive(message: OutboundMessage) -> bool:
    message_type = BY_KEY.get(message.kind)
    return bool(message_type and message_type.sensitive)


def _close_sensitive(message: OutboundMessage, status: str) -> None:
    message.status = status
    message.sealed_context = None
    message.save(update_fields=["status", "sealed_context", "updated_at"])


def _claim_secrets(message: OutboundMessage) -> bytes:
    """Prend les secrets et les efface en base dans la même transaction.

    Deux exécutions concurrentes de la tâche : une seule obtient les secrets,
    l'autre lève NotResendable. Le message part donc au plus une fois.
    """
    with transaction.atomic():
        locked = (
            OutboundMessage.objects.select_for_update()
            .filter(pk=message.pk, status=OutboundMessage.Status.APPROVED)
            .first()
        )
        if locked is None or not locked.sealed_context:
            raise NotResendable(f"Message sensible « {message.kind} » déjà pris en charge.")
        token = bytes(locked.sealed_context)
        locked.sealed_context = None
        locked.save(update_fields=["sealed_context", "updated_at"])
    message.sealed_context = None
    return token


def expire_sensitive(now=None) -> int:
    """Passe en EXPIRED les messages sensibles échus et efface leurs secrets.

    Rejouable : un second passage ne trouve plus rien à écrire.
    """
    now = now or timezone.now()
    keys = [key for key, message_type in BY_KEY.items() if message_type.sensitive]
    if not keys:
        return 0
    with transaction.atomic():
        expired = OutboundMessage.objects.filter(
            kind__in=keys,
            expires_at__lte=now,
            status__in=[OutboundMessage.Status.APPROVED, OutboundMessage.Status.PENDING_REVIEW],
        ).update(status=OutboundMessage.Status.EXPIRED, sealed_context=None, updated_at=now)
        # Filet : aucun secret ne survit à un message clos, quel que soit son statut.
        OutboundMessage.objects.filter(kind__in=keys, sealed_context__isnull=False).exclude(
            status__in=[OutboundMessage.Status.APPROVED, OutboundMessage.Status.PENDING_REVIEW],
        ).update(sealed_context=None, updated_at=now)
    return expired


def send_message(message: OutboundMessage, resent_from: EmailSendLog | None = None) -> EmailSendLog | None:
    sensitive = _is_sensitive(message)
    if sensitive and (resent_from is not None or message.status != OutboundMessage.Status.APPROVED):
        raise NotResendable(f"Message sensible « {message.kind} » : envoi unique, statut {message.status}.")
    if message.status not in (OutboundMessage.Status.APPROVED, OutboundMessage.Status.SENT):
        raise NotApproved(f"Message « {message.kind} » en statut {message.status}.")

    if sensitive:
        if message.expires_at is None or message.expires_at <= timezone.now():
            _close_sensitive(message, OutboundMessage.Status.EXPIRED)
            return None
        try:
            secrets = unseal(_claim_secrets(message))
        except SealingUnavailable:
            # Clé changée ou secrets déjà effacés : rien d'envoyable, le producteur redemandera.
            _close_sensitive(message, OutboundMessage.Status.FAILED)
            return None
        rendered = render_message(message, secrets)
    elif not message.rendered_subject:
        rendered = render_message(message)
    else:
        rendered = Rendered(message.rendered_subject, message.rendered_text, message.rendered_html)

    log = EmailSendLog.objects.create(
        message=message,
        to=message.to,
        cc=message.cc,
        status=EmailSendLog.Status.QUEUED,
        resent_from=resent_from,
    )

    try:
        get_backend().send(
            to=message.to,
            cc=message.cc,
            reply_to=message.reply_to,
            subject=rendered.subject,
            text=rendered.text,
            html=rendered.html,
        )
    except Exception as exc:
        log.status = EmailSendLog.Status.FAILED
        # Le message d'erreur d'un serveur peut citer le contenu : rien pour un sensible.
        log.error = type(exc).__name__ if sensitive else str(exc)[:2000]
        log.attempts += 1
        log.save(update_fields=["status", "error", "attempts", "updated_at"])
        if sensitive:
            _close_sensitive(message, OutboundMessage.Status.FAILED)
        else:
            message.status = OutboundMessage.Status.FAILED
            message.save(update_fields=["status", "updated_at"])
        return log

    log.status = EmailSendLog.Status.SENT
    log.attempts += 1
    log.sent_at = timezone.now()
    log.save(update_fields=["status", "attempts", "sent_at", "updated_at"])
    if sensitive:
        _close_sensitive(message, OutboundMessage.Status.SENT)
    else:
        message.status = OutboundMessage.Status.SENT
        message.save(update_fields=["status", "updated_at"])
    return log
