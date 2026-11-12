"""Version des besoins et file des copies à livrer à cfao-planning (outbox).

Les deux tables sont écrites par le trigger SQL de `analytics.0002`, jamais par
le code applicatif : une modification ne peut pas oublier de se signaler.
"""
from django.db import models


class NeedsState(models.Model):
    """Ligne unique (`id=1`) : version courante de ce que lit cfao-planning."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    version = models.BigIntegerField(default=0)
    updated_at = models.DateTimeField(null=True, blank=True)


class NeedsOutbox(models.Model):
    """Une ligne par transaction qui a changé les besoins ; le relais livre la dernière copie."""

    version = models.BigIntegerField(unique=True)
    created_at = models.DateTimeField()
    next_attempt_at = models.DateTimeField()
    attempts = models.PositiveIntegerField(default=0)
    delivered_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        indexes = [models.Index(fields=["delivered_at", "next_attempt_at"], name="needs_outbox_due")]
