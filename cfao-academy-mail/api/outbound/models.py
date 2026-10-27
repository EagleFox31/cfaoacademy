from django.db import models

from core.models import TimeStampedModel, UUIDModel


class EmailTemplate(UUIDModel, TimeStampedModel):
    key = models.CharField(max_length=96)
    version = models.PositiveIntegerField(default=1)
    locale = models.CharField(max_length=8, default="fr")
    subject = models.CharField(max_length=255)
    body_text = models.TextField()
    body_html = models.TextField(blank=True)
    placeholders = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["key", "locale", "-version"]
        constraints = [
            models.UniqueConstraint(fields=["key", "locale", "version"], name="uniq_mail_template_version"),
        ]

    def __str__(self) -> str:
        return f"{self.key}/{self.locale} v{self.version}"


class OutboundMessage(UUIDModel, TimeStampedModel):
    class Status(models.TextChoices):
        PENDING_REVIEW = "PENDING_REVIEW", "À relire"
        APPROVED = "APPROVED", "Approuvé"
        SENT = "SENT", "Envoyé"
        FAILED = "FAILED", "Échec"
        REJECTED = "REJECTED", "Rejeté"

    kind = models.CharField(max_length=96)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING_REVIEW,
    )
    source_app = models.CharField(max_length=32, blank=True)
    source_ref = models.CharField(max_length=128, blank=True)
    correlation_id = models.CharField(max_length=160, null=True, blank=True, db_index=True)

    to = models.JSONField(default=list)
    cc = models.JSONField(default=list)
    reply_to = models.CharField(max_length=254, blank=True)

    template = models.ForeignKey(
        EmailTemplate, null=True, blank=True, on_delete=models.PROTECT, related_name="messages",
    )
    template_version = models.PositiveIntegerField(default=0)
    locale = models.CharField(max_length=8, default="fr")
    rendered_subject = models.CharField(max_length=255, blank=True)
    rendered_text = models.TextField(blank=True)
    rendered_html = models.TextField(blank=True)
    context = models.JSONField(default=dict)

    reviewed_by = models.CharField(max_length=128, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reject_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["kind", "status"]),
            models.Index(fields=["source_app", "-created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["correlation_id"],
                condition=models.Q(correlation_id__isnull=False) & ~models.Q(status="REJECTED"),
                name="uniq_mail_correlation_active",
            ),
        ]

    @property
    def awaits_review(self) -> bool:
        return self.status == self.Status.PENDING_REVIEW


class EmailSendLog(UUIDModel, TimeStampedModel):
    class Status(models.TextChoices):
        QUEUED = "QUEUED", "En file"
        SENT = "SENT", "Envoyé"
        FAILED = "FAILED", "Échec"
        BOUNCED = "BOUNCED", "Rejeté par le serveur"

    message = models.ForeignKey(
        OutboundMessage, on_delete=models.CASCADE, related_name="send_logs",
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED)
    to = models.JSONField(default=list)
    cc = models.JSONField(default=list)
    attempts = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    resent_from = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="resends",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]
