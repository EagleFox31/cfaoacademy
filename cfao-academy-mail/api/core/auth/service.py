import secrets

from django.conf import settings
from rest_framework.permissions import BasePermission


class HasMailServiceKey(BasePermission):
    """Appels service-à-service (needs, rapports, core, ops)."""

    message = "Clé service mail manquante ou invalide."

    def has_permission(self, request, view) -> bool:
        expected = settings.MAIL_INBOUND_KEY
        if not expected:
            return False
        provided = request.headers.get("X-Mail-Service-Key", "")
        return secrets.compare_digest(provided, expected)
