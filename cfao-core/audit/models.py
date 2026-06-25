"""Journal d'audit — append-only, transverse (story 12-4 / OWASP A09 / RGPD).

Trace les actions sensibles (qui, quoi, sur quelle ressource, dans quel périmètre, quand).
`org_path` porte le périmètre de la ressource auditée → lecture scopée comme les autres ressources.
"""
from django.db import models

from core.models import UUIDModel


class AuditEvent(UUIDModel):
    created_at = models.DateTimeField(auto_now_add=True)
    actor_sub = models.CharField(max_length=64)            # qui (keycloak sub)
    actor_roles = models.JSONField(default=list)
    action = models.CharField(max_length=64)               # ex. assignment.create
    resource_kind = models.CharField(max_length=64)
    resource_id = models.CharField(max_length=255, blank=True)
    org_path = models.JSONField(default=list)              # périmètre (scope de l'audit)
    metadata = models.JSONField(default=dict)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.actor_sub} {self.action}"
