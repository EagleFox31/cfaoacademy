"""Points d'entrée entre modules, sur le réseau `cfao-maillage` seulement.

- `needs-snapshot-push` : réception de la copie des besoins poussée par cfao-needs ;
- `cr-sessions` : sessions à documenter, lues par le module Comptes rendus.

Appels de service à service : ni jeton utilisateur ni Cerbos, une clé partagée
par contrat. Clé absente côté planning = tout est refusé (fail-close). L'edge ne
publie pas `/internal/`.
"""
from __future__ import annotations

from django.conf import settings
from django.utils.crypto import constant_time_compare
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .services.cr_sessions import InvalidQuery, parse_days, sessions_to_document
from .services.needs_copy import PUSH, SnapshotInvalid, apply_snapshot, known_version


def _key_ok(request, setting: str, header: str) -> bool:
    expected = getattr(settings, setting, "") or ""
    provided = request.META.get(header, "")
    return bool(expected and provided and constant_time_compare(expected, provided))


class NeedsSnapshotPushView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        if not _key_ok(request, "NEEDS_SNAPSHOT_INBOUND_KEY", "HTTP_X_NEEDS_SNAPSHOT_KEY"):
            return Response({"detail": "invalid_snapshot_key"}, status=403)
        try:
            applied = apply_snapshot(request.data, PUSH)
        except SnapshotInvalid as exc:
            return Response({"detail": f"invalid_snapshot: {exc}"}, status=400)
        return Response({"applied": applied, "version": known_version()})


class CrSessionsView(APIView):
    """GET conditionnel : `If-None-Match` égal à la révision courante = 304 sans corps."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        if not _key_ok(request, "CR_SESSIONS_KEY", "HTTP_X_CR_SESSIONS_KEY"):
            return Response({"detail": "invalid_cr_sessions_key"}, status=403)
        try:
            days = parse_days(request.query_params.get("days"))
        except InvalidQuery as exc:
            return Response({"detail": str(exc)}, status=400)
        body = sessions_to_document(days, request.query_params.get("trainer") or None)
        etag = f'"{body["revision"]}"'
        if request.META.get("HTTP_IF_NONE_MATCH", "") == etag:
            response = Response(status=304)
        else:
            response = Response(body)
        response["ETag"] = etag
        response["Cache-Control"] = "no-cache"
        return response
