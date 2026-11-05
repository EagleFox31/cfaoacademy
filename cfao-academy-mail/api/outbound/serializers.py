from rest_framework import serializers

from outbound.models import OutboundMessage


class EnqueueSerializer(serializers.Serializer):
    kind = serializers.CharField(max_length=96)
    to = serializers.ListField(child=serializers.EmailField(), allow_empty=False)
    cc = serializers.ListField(child=serializers.EmailField(), required=False, default=list)
    reply_to = serializers.EmailField(required=False, allow_blank=True, default="")
    module_url = serializers.URLField(required=False, allow_blank=True, default="")
    locale = serializers.ChoiceField(choices=["fr", "en"], default="fr")
    context = serializers.DictField(required=False, default=dict)
    source_app = serializers.CharField(max_length=32, required=False, default="")
    source_ref = serializers.CharField(max_length=128, required=False, default="")
    correlation_id = serializers.CharField(max_length=160, required=False, allow_blank=True)

    def to_internal_value(self, data):
        if isinstance(data, dict):
            unknown = set(data) - set(self.fields)
            if unknown:
                raise serializers.ValidationError({key: "Champ inconnu." for key in sorted(unknown)})
        return super().to_internal_value(data)


class OutboundMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = OutboundMessage
        fields = (
            "id", "kind", "status", "source_app", "source_ref", "correlation_id",
            "to", "cc", "reply_to", "locale", "created_at", "updated_at",
        )
