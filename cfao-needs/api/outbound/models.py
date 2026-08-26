"""File de sortie, templates versionnés et journal d'envoi.

Trois besoins distincts, trois tables :
  - `OutboundMessage` : ce qu'on **a l'intention** d'envoyer, en attente de relecture
  - `EmailTemplate`   : ce avec quoi on le rend, **versionné**
  - `EmailSendLog`    : ce qui est **réellement** parti, et ce qui a échoué

Le journal d'envoi avec renvoi manuel est repris d'Academix (F17) — la seule partie
de son emailing qui ait résisté à un relais SMTP interne peu fiable.
"""
from django.db import models

from campaigns.models import Campaign, Submission
from core.models import TimeStampedModel, UUIDModel


class EmailTemplate(UUIDModel, TimeStampedModel):
    """Template **versionné** et localisé.

    Un envoi référence la version utilisée : un template modifié après coup ne
    réécrit pas l'historique. L'absence d'une traduction est une erreur de CI, pas
    un repli silencieux (story 14-16).
    """

    key = models.CharField(max_length=64)
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
            models.UniqueConstraint(
                fields=["key", "locale", "version"], name="uniq_template_version"
            )
        ]

    def __str__(self) -> str:
        return f"{self.key}/{self.locale} v{self.version}"


class OutboundMessage(UUIDModel, TimeStampedModel):
    """Une intention d'envoi.

    Tout message vers une adresse hors équipe Academy naît en `PENDING_REVIEW` et
    n'en sort que par une action explicite d'un membre de l'équipe. Les messages
    internes (`AUTO`) naissent directement en `APPROVED`.
    """

    class Status(models.TextChoices):
        PENDING_REVIEW = "PENDING_REVIEW", "À relire"
        APPROVED = "APPROVED", "Approuvé"
        SENT = "SENT", "Envoyé"
        FAILED = "FAILED", "Échec"
        REJECTED = "REJECTED", "Rejeté"

    kind = models.CharField(max_length=64)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING_REVIEW
    )

    campaign = models.ForeignKey(
        Campaign, null=True, blank=True, on_delete=models.CASCADE, related_name="messages"
    )
    submission = models.ForeignKey(
        Submission, null=True, blank=True, on_delete=models.CASCADE, related_name="messages"
    )

    to = models.JSONField(default=list)
    cc = models.JSONField(default=list)

    template = models.ForeignKey(
        EmailTemplate, null=True, blank=True, on_delete=models.PROTECT, related_name="messages"
    )
    template_version = models.PositiveIntegerField(default=0)
    locale = models.CharField(max_length=8, default="fr")
    # Rendu figé au moment de la préparation : ce que le relecteur voit est
    # exactement ce qui partira.
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
        ]

    def __str__(self) -> str:
        return f"{self.kind} → {', '.join(self.to)} [{self.status}]"

    @property
    def awaits_review(self) -> bool:
        return self.status == self.Status.PENDING_REVIEW


class EmailSendLog(UUIDModel, TimeStampedModel):
    """Ce qui est réellement parti — avec renvoi manuel (F17).

    Réessai automatique à intervalle croissant (1 min, 5 min, 30 min, 2 h) puis
    abandon avec alerte. `attempts` est stocké pour que le worker ne rejoue pas
    indéfiniment.
    """

    class Status(models.TextChoices):
        QUEUED = "QUEUED", "En file"
        SENT = "SENT", "Envoyé"
        FAILED = "FAILED", "Échec"
        BOUNCED = "BOUNCED", "Rejeté par le serveur"

    message = models.ForeignKey(
        OutboundMessage, on_delete=models.CASCADE, related_name="send_logs"
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED)
    to = models.JSONField(default=list)
    cc = models.JSONField(default=list)
    attempts = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    resent_from = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="resends"
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.message.kind} · {self.status}"
