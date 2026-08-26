from rest_framework import serializers

from referential.models import CatalogFamily

from .models import Campaign, CatalogLine, NeedLine, Submission, SubmissionCc, SubmissionEvent


class CampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = [
            "id", "year", "label", "status",
            "opens_at", "closes_at", "default_locale",
        ]


class CatalogLineSerializer(serializers.ModelSerializer):
    family_key = serializers.CharField(source="family.key", read_only=True)
    family_label = serializers.CharField(source="family.label", read_only=True)
    family_status = serializers.CharField(source="family.status", read_only=True)
    brand_code = serializers.CharField(source="brand.code", read_only=True, default=None)
    brand_label = serializers.CharField(source="brand.label", read_only=True, default=None)
    pole = serializers.CharField(source="family.pole", read_only=True)

    class Meta:
        model = CatalogLine
        fields = [
            "id", "code", "title", "tier", "populations",
            "family_key", "family_label", "family_status", "pole",
            "brand_code", "brand_label", "sort_order",
        ]


class NeedLineSerializer(serializers.ModelSerializer):
    catalog_line_id = serializers.UUIDField(source="catalog_line.id", read_only=True)
    total = serializers.IntegerField(read_only=True)

    class Meta:
        model = NeedLine
        fields = [
            "id", "catalog_line_id", "total",
            "q1", "q2", "q3", "q4",
            "place_q1", "place_q2", "place_q3", "place_q4",
            "comment",
        ]


class NeedLineWriteSerializer(serializers.Serializer):
    """Écriture **incrémentale** par lot — jamais un remplacement de la liste.

    Academix remplaçait la liste entière à chaque enregistrement : on perdait qui
    avait été retiré et quand (docs/AUDIT_ACADEMIX.md §3, principe 3). Ici le client
    envoie les lignes qu'il a touchées, et chaque changement produit un événement.
    """

    catalog_line = serializers.UUIDField()
    q1 = serializers.IntegerField(min_value=0, default=0)
    q2 = serializers.IntegerField(min_value=0, default=0)
    q3 = serializers.IntegerField(min_value=0, default=0)
    q4 = serializers.IntegerField(min_value=0, default=0)
    place_q1 = serializers.CharField(required=False, default="CFR")
    place_q2 = serializers.CharField(required=False, default="CFR")
    place_q3 = serializers.CharField(required=False, default="CFR")
    place_q4 = serializers.CharField(required=False, default="CFR")
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class SubmissionCcSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionCc
        fields = ["id", "email", "label", "source"]


class SubmissionEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionEvent
        fields = ["id", "at", "actor", "on_behalf_of", "kind", "payload"]


class SubmissionSerializer(serializers.ModelSerializer):
    org_unit_code = serializers.CharField(source="org_unit.code", read_only=True)
    org_unit_label = serializers.CharField(source="org_unit.label", read_only=True)
    cc = SubmissionCcSerializer(many=True, read_only=True)
    is_editable = serializers.BooleanField(read_only=True)

    class Meta:
        model = Submission
        fields = [
            "id", "campaign", "org_unit", "org_unit_code", "org_unit_label", "country",
            "status", "is_editable", "total_headcount",
            "submitted_at", "validated_at", "reopen_reason",
            "reminder_state", "last_reminder_at", "last_activity_at", "cc",
        ]
        read_only_fields = [
            "status", "total_headcount", "submitted_at", "validated_at",
            "reopen_reason", "reminder_state", "last_reminder_at", "last_activity_at",
        ]


class CampaignSummarySerializer(serializers.Serializer):
    """Récapitulatif présenté avant soumission et dans l'email interne."""

    total_headcount = serializers.IntegerField()
    by_quarter = serializers.DictField(child=serializers.IntegerField())
    by_place = serializers.DictField(child=serializers.IntegerField())
    trainings_selected = serializers.IntegerField()
    families_touched = serializers.ListField(child=serializers.CharField())
