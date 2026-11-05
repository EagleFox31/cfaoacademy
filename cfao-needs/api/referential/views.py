"""Référentiel — lecture pour tout compte authentifié, écriture réservée.

Le référentiel n'est pas un secret : familles, marques et organisation sont
lisibles par tout compte connecté. Ce qui est filtré, ce sont les **lignes de
catalogue** (campaigns.views) — par query plan Cerbos.
"""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from core.authz.permissions import CerbosPermission

from .models import Brand, CatalogFamily, OrgUnitRef
from .serializers import BrandSerializer, CatalogFamilySerializer, OrgUnitSerializer


class CatalogFamilyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "needs_campaign"
    queryset = CatalogFamily.objects.exclude(status=CatalogFamily.Status.HIDDEN)
    serializer_class = CatalogFamilySerializer


class BrandViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "needs_campaign"
    queryset = Brand.objects.filter(is_active=True)
    serializer_class = BrandSerializer


class OrgUnitViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "needs_campaign"
    queryset = OrgUnitRef.objects.filter(is_active=True)
    serializer_class = OrgUnitSerializer
