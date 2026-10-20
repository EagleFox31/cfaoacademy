from rest_framework import serializers
from .models import SampleItem

class SampleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SampleItem
        fields = "__all__"
