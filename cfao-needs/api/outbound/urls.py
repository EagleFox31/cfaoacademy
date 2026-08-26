from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import EmailSendLogViewSet, OutboundMessageViewSet, resend_log

router = SimpleRouter()
router.register(r"outbound", OutboundMessageViewSet, basename="outbound")
router.register(r"emails/logs", EmailSendLogViewSet, basename="email-log")

urlpatterns = [
    *router.urls,
    path("emails/logs/<uuid:pk>/resend", resend_log, name="email-log-resend"),
]
