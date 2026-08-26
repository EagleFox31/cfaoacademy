from rest_framework import serializers

from .models import Brand, CatalogFamily, OrgUnitRef


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["id", "code", "label", "pole", "is_active", "sort_order"]


class CatalogFamilySerializer(serializers.ModelSerializer):
    is_open = serializers.BooleanField(read_only=True)

    class Meta:
        model = CatalogFamily
        fields = ["id", "key", "label", "pole", "has_brands", "status", "is_open", "sort_order"]


class OrgUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgUnitRef
        fields = ["id", "code", "label", "country", "locale", "org_path", "parent", "is_active"]
