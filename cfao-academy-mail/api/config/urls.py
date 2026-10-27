import json

from django.http import JsonResponse
from django.urls import include, path

from outbound.contract import CONTRACT_PATH


def healthz(_request):
    return JsonResponse({"status": "ok", "service": "cfao-academy-mail"})


def mail_contract(_request):
    document = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    return JsonResponse(document, json_dumps_params={"ensure_ascii": False})


urlpatterns = [
    path("api/v1/mail/healthz", healthz),
    path("api/v1/mail/contract", mail_contract),
    path("api/v1/mail/", include("outbound.urls")),
]
