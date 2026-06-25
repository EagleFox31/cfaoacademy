from rest_framework import serializers

from .models import OrgUnit, RoleAssignment, User


class OrgUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgUnit
        fields = ["id", "kind", "slug", "name", "parent", "code", "path"]
        read_only_fields = ["code", "path"]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "keycloak_sub", "email", "first_name", "last_name", "scope_paths"]
        read_only_fields = ["scope_paths"]


class AssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoleAssignment
        fields = ["id", "role", "scope_unit", "brands", "active"]
