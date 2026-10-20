from rest_framework import serializers

from .models import Course, Enrollment, Module


class ModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = ["id", "course", "order", "title", "kind", "content_ref"]


class CourseSerializer(serializers.ModelSerializer):
    modules = ModuleSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = ["id", "title", "brand", "functional_group", "level", "summary", "published", "modules"]


class EnrollmentSerializer(serializers.ModelSerializer):
    # learner_sub optionnel : par défaut l'apprenant courant (auto-inscription). org_path serveur.
    learner_sub = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Enrollment
        fields = ["id", "learner_sub", "course", "status", "progress_pct", "org_path"]
        read_only_fields = ["org_path"]
        # `learner_sub` est fixé côté serveur (self ou affectation) → on retire le
        # UniqueTogetherValidator auto (qui exigerait learner_sub en entrée). L'unicité
        # (learner_sub, course) reste garantie en base.
        validators = []
