from outbound.models import OutboundMessage
from outbound.services.sender import send_message


def dispatch_message(message_id: str) -> None:
    message = OutboundMessage.objects.get(pk=message_id)
    if message.status != OutboundMessage.Status.APPROVED:
        return
    send_message(message)
