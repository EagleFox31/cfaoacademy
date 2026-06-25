"""Enregistrement d'un événement d'audit. Appelé depuis la couche vue (l'acteur y est connu)."""
from .models import AuditEvent


def record_audit(*, actor, action, resource_kind, resource_id="", org_path=None, metadata=None):
    return AuditEvent.objects.create(
        actor_sub=getattr(actor, "id", "") or "",
        actor_roles=list(getattr(actor, "roles", []) or []),
        action=action,
        resource_kind=resource_kind,
        resource_id=str(resource_id or ""),
        org_path=list(org_path or []),
        metadata=metadata or {},
    )
