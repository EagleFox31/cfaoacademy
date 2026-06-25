"""Modèles de base réutilisés par tous les modules (architecture.md §4.2)."""
import uuid

from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class ScopedModel(UUIDModel, TimeStampedModel):
    """Porte le périmètre 3D (org × département × marque) que Cerbos évalue.

    org_path : chaîne d'ancêtres org (ex. ["groupe", "groupe.cmr", "groupe.cmr.douala"]).
    En prod, candidat à un ArrayField Postgres + index GIN ; JSONField ici pour rester
    portable (tests SQLite). La condition `scopeNode ∈ org_path` est gérée par Cerbos.
    """

    org_path = models.JSONField(default=list)
    department = models.CharField(max_length=64, blank=True)
    brand = models.CharField(max_length=64, blank=True)

    class Meta:
        abstract = True
