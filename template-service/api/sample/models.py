from django.db import models
import uuid

class SampleItem(models.Model):
    """Exemple d'entité métier avec rattachement au périmètre organisationnel."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    scope_node = models.CharField(max_length=64, help_text="Code agence ou filiale, ex: CMR ou CIV-ABJ")
    brand = models.CharField(max_length=64, help_text="Marque rattachée, ex: TOYOTA")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.brand} - {self.scope_node})"
