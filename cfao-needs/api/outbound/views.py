"""Écran « À envoyer » et journal d'envoi.

`needs_outbound` est la ressource Cerbos la plus sensible du module : elle décide
qui peut faire sortir un email vers une filiale. Réservée à l'équipe Academy, avec
tests négatifs obligatoires sur les rôles de filiale.
"""
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.authz import cerbos
from core.authz.permissions import CerbosPermission

from .models import EmailSendLog, OutboundMessage
from .serializers import (
    EmailSendLogSerializer,
    OutboundMessageSerializer,
    OutboundPreviewSerializer,
)


class OutboundMessageViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "needs_outbound"
    serializer_class = OutboundMessageSerializer

    def get_queryset(self):
        queryset = OutboundMessage.objects.select_related("submission", "campaign")
        state = self.request.query_params.get("status")
        if state:
            return queryset.filter(status=state)
        return queryset.filter(status=OutboundMessage.Status.PENDING_REVIEW)

    def _authorize(self, obj, action_name: str) -> bool:
        return cerbos.check(
            self.request.user.to_cerbos(),
            "needs_outbound",
            str(obj.id),
            {"kind": obj.kind, "status": obj.status},
            action_name,
        )

    @action(detail=True, methods=["get"])
    def preview(self, request, pk=None):
        message = self.get_object()
        from .services.render import render_message

        render_message(message)
        return Response(OutboundPreviewSerializer(message).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        message = self.get_object()
        if not self._authorize(message, "approve"):
            return Response({"detail": "Approbation non autorisée."}, status=status.HTTP_403_FORBIDDEN)
        if not message.awaits_review:
            return Response(
                {"detail": "Ce message n'est plus en attente de relecture."},
                status=status.HTTP_409_CONFLICT,
            )
        message.status = OutboundMessage.Status.APPROVED
        message.reviewed_by = request.user.id
        message.reviewed_at = timezone.now()
        message.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
        return Response(OutboundMessageSerializer(message).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        message = self.get_object()
        if not self._authorize(message, "reject"):
            return Response({"detail": "Rejet non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response(
                {"detail": "Un motif de rejet est obligatoire : il reste au dossier."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        message.status = OutboundMessage.Status.REJECTED
        message.reject_reason = reason
        message.reviewed_by = request.user.id
        message.reviewed_at = timezone.now()
        message.save(
            update_fields=["status", "reject_reason", "reviewed_by", "reviewed_at", "updated_at"]
        )
        return Response(OutboundMessageSerializer(message).data)

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        message = self.get_object()
        if not self._authorize(message, "send"):
            return Response({"detail": "Envoi non autorisé."}, status=status.HTTP_403_FORBIDDEN)
        from .services.sender import send_message

        log = send_message(message)
        return Response(EmailSendLogSerializer(log).data, status=status.HTTP_202_ACCEPTED)


class EmailSendLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "needs_outbound"
    queryset = EmailSendLog.objects.select_related("message")
    serializer_class = EmailSendLogSerializer


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resend_log(request, pk):
    """Renvoi manuel — repris d'Academix (F17), la parade au relais SMTP capricieux."""
    log = EmailSendLog.objects.select_related("message").filter(pk=pk).first()
    if not log:
        return Response({"detail": "Journal introuvable."}, status=status.HTTP_404_NOT_FOUND)
    allowed = cerbos.check(
        request.user.to_cerbos(),
        "needs_outbound",
        str(log.message_id),
        {"kind": log.message.kind, "status": log.message.status},
        "send",
    )
    if not allowed:
        return Response({"detail": "Renvoi non autorisé."}, status=status.HTTP_403_FORBIDDEN)

    from .services.sender import send_message

    new_log = send_message(log.message, resent_from=log)
    return Response(EmailSendLogSerializer(new_log).data, status=status.HTTP_202_ACCEPTED)
