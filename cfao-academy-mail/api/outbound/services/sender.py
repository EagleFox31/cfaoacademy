from __future__ import annotations

from django.utils import timezone

from outbound.models import EmailSendLog, OutboundMessage

from .backends import get_backend
from .render import render_message


class NotApproved(Exception):
    pass


def send_message(message: OutboundMessage, resent_from: EmailSendLog | None = None) -> EmailSendLog:
    if message.status not in (OutboundMessage.Status.APPROVED, OutboundMessage.Status.SENT):
        raise NotApproved(f"Message « {message.kind} » en statut {message.status}.")

    if not message.rendered_subject:
        render_message(message)

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
            subject=message.rendered_subject,
            text=message.rendered_text,
            html=message.rendered_html,
        )
    except Exception as exc:
        log.status = EmailSendLog.Status.FAILED
        log.error = str(exc)[:2000]
        log.attempts += 1
        log.save(update_fields=["status", "error", "attempts", "updated_at"])
        message.status = OutboundMessage.Status.FAILED
        message.save(update_fields=["status", "updated_at"])
        return log

    log.status = EmailSendLog.Status.SENT
    log.attempts += 1
    log.sent_at = timezone.now()
    log.save(update_fields=["status", "attempts", "sent_at", "updated_at"])
    message.status = OutboundMessage.Status.SENT
    message.save(update_fields=["status", "updated_at"])
    return log
