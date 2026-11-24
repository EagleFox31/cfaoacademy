from rest_framework import serializers

from .models import OrgUnit, RoleAssignment, User


class OrgUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgUnit
        fields = ["id", "kind", "slug", "name", "parent", "code", "path"]
        read_only_fields = ["code", "path"]


class UserSerializer(serializers.ModelSerializer):
    # Rôles des affectations actives (lecture seule) : la console d'administration
    # les affiche sans un appel par compte.
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "keycloak_sub", "email", "first_name", "last_name", "scope_paths", "roles"]
        read_only_fields = ["scope_paths", "roles"]

    def get_roles(self, obj):
        # `.all()` profite du prefetch de la vue liste ; filtre actif côté Python.
        return sorted({a.role for a in obj.assignments.all() if a.active})


class AssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoleAssignment
        fields = ["id", "role", "scope_unit", "brands", "active"]
