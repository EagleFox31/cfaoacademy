"""Journal d'import — le rapport est persistant, pas un message éphémère.

Règle 3 du patron : la personne qui corrige son fichier doit pouvoir revenir sur
le rapport, et le télécharger en XLSX pour travailler dans son outil.
"""
from django.db import models

from core.models import TimeStampedModel, UUIDModel


class ImportLog(UUIDModel, TimeStampedModel):
    class Status(models.TextChoices):
        PREVIEW = "PREVIEW", "Prévisualisation"
        APPLIED = "APPLIED", "Appliqué"
        REJECTED = "REJECTED", "Rejeté"

    kind = models.CharField(max_length=64)
    actor = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices)
    rows_written = models.IntegerField(default=0)
    report = models.JSONField(default=dict)

    class Meta:
        app_label = "core"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["kind", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.kind} · {self.status} · {self.created_at:%Y-%m-%d %H:%M}"
