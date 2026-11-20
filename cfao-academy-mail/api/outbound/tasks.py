from outbound.models import OutboundMessage
from outbound.services.sender import NotResendable, expire_sensitive, send_message


def dispatch_message(message_id: str) -> None:
    message = OutboundMessage.objects.get(pk=message_id)
    if message.status != OutboundMessage.Status.APPROVED:
        return
    try:
        send_message(message)
    except NotResendable:
        # Une autre exécution a déjà pris le message sensible : rien à faire.
        return


def purge_sensitive_messages() -> int:
    """Tâche planifiée (Schedule créée par `ensure_mail_schedules`)."""
    return expire_sensitive()
