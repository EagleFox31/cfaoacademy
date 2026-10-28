from django_q.tasks import async_task
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from core.auth.service import HasMailServiceKey

from .models import OutboundMessage
from .serializers import EnqueueSerializer, OutboundMessageSerializer
from .services.queue import ForbiddenSend, enqueue


def _detail(errors) -> str:
    if isinstance(errors, dict):
        return " ".join(f"{key}: {_detail(value)}" for key, value in errors.items())
    if isinstance(errors, list):
        return "; ".join(_detail(item) for item in errors)
    return str(errors)


@api_view(["POST"])
@permission_classes([HasMailServiceKey])
def enqueue_message(request):
    serializer = EnqueueSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({"detail": _detail(serializer.errors)}, status=status.HTTP_400_BAD_REQUEST)
    data = serializer.validated_data

    try:
        message, created = enqueue(
            data["kind"],
            data["to"],
            cc=data.get("cc"),
            reply_to=data.get("reply_to") or "",
            module_url=data.get("module_url") or "",
            locale=data.get("locale", "fr"),
            context=data.get("context"),
            source_app=data.get("source_app", ""),
            source_ref=data.get("source_ref", ""),
            correlation_id=data.get("correlation_id") or None,
        )
    except ForbiddenSend as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    if created and message.status == OutboundMessage.Status.APPROVED:
        async_task("outbound.tasks.dispatch_message", str(message.id))

    code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return Response(
        {"message": OutboundMessageSerializer(message).data, "created": created},
        status=code,
    )
