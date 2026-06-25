from rest_framework import serializers

from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = ["id", "created_at", "actor_sub", "actor_roles", "action",
                  "resource_kind", "resource_id", "org_path", "metadata"]
