from rest_framework import serializers

from .catalog import BY_KEY
from .models import EmailSendLog, EmailTemplate, OutboundMessage


class OutboundMessageSerializer(serializers.ModelSerializer):
    description = serializers.SerializerMethodField()
    audience = serializers.SerializerMethodField()
    submission_label = serializers.SerializerMethodField()

    class Meta:
        model = OutboundMessage
        fields = [
            "id", "kind", "description", "audience", "status", "locale",
            "to", "cc", "rendered_subject", "submission", "submission_label",
            "reviewed_by", "reviewed_at", "reject_reason", "created_at",
        ]
        read_only_fields = fields

    def get_description(self, obj) -> str:
        message_type = BY_KEY.get(obj.kind)
        return message_type.description if message_type else ""

    def get_audience(self, obj) -> str:
        message_type = BY_KEY.get(obj.kind)
        return message_type.audience if message_type else "EXTERNAL"

    def get_submission_label(self, obj) -> str:
        return str(obj.submission) if obj.submission_id else ""


class OutboundPreviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = OutboundMessage
        fields = ["id", "kind", "locale", "to", "cc", "rendered_subject", "rendered_text", "rendered_html"]
        read_only_fields = fields


class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = [
            "id", "key", "version", "locale", "subject",
            "body_text", "body_html", "placeholders", "is_active",
        ]


class EmailSendLogSerializer(serializers.ModelSerializer):
    kind = serializers.CharField(source="message.kind", read_only=True)

    class Meta:
        model = EmailSendLog
        fields = [
            "id", "kind", "status", "to", "cc",
            "attempts", "error", "sent_at", "created_at",
        ]
        read_only_fields = fields
