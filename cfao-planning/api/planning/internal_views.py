"""Réception de la copie des besoins poussée par cfao-needs (contrat `needs-snapshot-push`).

Appel de service à service sur le réseau `cfao-maillage` : ni jeton utilisateur
ni Cerbos, une clé partagée `X-Needs-Snapshot-Key`. Clé absente côté planning =
tout est refusé (fail-close). La passerelle ne publie pas `/internal/`.
"""
from __future__ import annotations

from django.conf import settings
from django.utils.crypto import constant_time_compare
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .services.needs_copy import PUSH, SnapshotInvalid, apply_snapshot, known_version


class NeedsSnapshotPushView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        expected = getattr(settings, "NEEDS_SNAPSHOT_INBOUND_KEY", "") or ""
        provided = request.META.get("HTTP_X_NEEDS_SNAPSHOT_KEY", "")
        if not expected or not provided or not constant_time_compare(expected, provided):
            return Response({"detail": "invalid_snapshot_key"}, status=403)
        try:
            applied = apply_snapshot(request.data, PUSH)
        except SnapshotInvalid as exc:
            return Response({"detail": f"invalid_snapshot: {exc}"}, status=400)
        return Response({"applied": applied, "version": known_version()})
