import secrets

from django.conf import settings
from rest_framework.permissions import BasePermission


def source_for_key(provided: str) -> tuple[bool, str | None]:
    """(clé valide, source imposée). La clé commune n'impose pas de source.

    Toutes les clés sont comparées, sans sortie anticipée, à temps constant.
    """
    valid = False
    bound: str | None = None
    if not provided:
        return False, None
    for key, source in (getattr(settings, "MAIL_INBOUND_KEYS", {}) or {}).items():
        if key and secrets.compare_digest(provided, key):
            valid, bound = True, source
    shared = settings.MAIL_INBOUND_KEY
    if bound is None and shared and secrets.compare_digest(provided, shared):
        valid = True
    return valid, bound


class HasMailServiceKey(BasePermission):
    """Appels service-à-service (needs, rapports, core, ops, identity).

    Pose `request.mail_source` : la source liée à la clé, ou None pour la clé commune.
    """

    message = "Clé service mail manquante ou invalide."

    def has_permission(self, request, view) -> bool:
        valid, bound = source_for_key(request.headers.get("X-Mail-Service-Key", ""))
        request.mail_source = bound
        return valid
