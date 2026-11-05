from django.urls import path

from .views import enqueue_message

urlpatterns = [
    path("messages/enqueue", enqueue_message, name="mail-enqueue"),
]
