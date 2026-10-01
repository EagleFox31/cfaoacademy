from rest_framework import viewsets
from rest_framework.response import Response
from .models import SampleItem
from .serializers import SampleItemSerializer
from core.auth.identity import get_identity_provider
from core.authz.cerbos import enforce_permission

class SampleItemViewSet(viewsets.ModelViewSet):
    """Exemple de ViewSet protégé par le PEP Cerbos et utilisant l'Identity Adapter."""
    queryset = SampleItem.objects.all()
    serializer_class = SampleItemSerializer

    def get_principal(self, request):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "") if "Bearer " in auth_header else ""
        user_id = request.headers.get("X-User-ID", "demo-user")
        provider = get_identity_provider()
        return provider.resolve_user(user_id=user_id, raw_token=token)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        principal = self.get_principal(request)
        resource = {
            "kind": "sample_resource",
            "id": str(instance.id),
            "attr": {
                "scopeNode": instance.scope_node,
                "brand": instance.brand,
            },
        }
        enforce_permission(principal, resource, "read")
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def perform_create(self, serializer):
        principal = self.get_principal(self.request)
        scope_node = serializer.validated_data.get("scope_node")
        brand = serializer.validated_data.get("brand")
        resource = {
            "kind": "sample_resource",
            "id": "new",
            "attr": {
                "scopeNode": scope_node,
                "brand": brand,
            },
        }
        enforce_permission(principal, resource, "create")
        serializer.save()
