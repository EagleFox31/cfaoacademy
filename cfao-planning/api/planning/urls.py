"""Routes de la clé de répartition, sous `/api/v1/planning/` (SPEC §6)."""
from django.urls import path

from . import views as v

urlpatterns = [
    path("access", v.AccessView.as_view()),
    path("cost-keys/", v.CostKeyListView.as_view()),
    path("cost-keys/<uuid:pk>", v.CostKeyDetailView.as_view()),
    path("cost-keys/<uuid:pk>/report", v.CostKeyReportView.as_view()),
    path("cost-keys/<uuid:pk>/freeze", v.CostKeyFreezeView.as_view()),
    path("cost-keys/<uuid:pk>/compare", v.CostKeyCompareView.as_view()),
    path("cost-keys/<uuid:pk>/match", v.CostKeyMatchView.as_view()),
    path("cost-keys/<uuid:pk>/global", v.CostKeyGlobalView.as_view()),
    path("cost-keys/<uuid:pk>/global.xlsx", v.CostKeyGlobalXlsxView.as_view()),
    path("cost-keys/<uuid:pk>/abc", v.CostKeyAbcView.as_view()),
    path("cost-keys/<uuid:pk>/countries/<slug:code>", v.CountrySheetView.as_view()),
    path("cost-keys/<uuid:pk>/countries/<slug:code>.xlsx", v.CountrySheetXlsxView.as_view()),
    path("cost-keys/<uuid:pk>/export.xlsx", v.CostKeyExportView.as_view()),
    path("cost-keys/<uuid:pk>/unchosen-modules", v.UnchosenModulesView.as_view()),
    path("years/<int:year>/global", v.YearGlobalView.as_view()),
    path("years/<int:year>/global.xlsx", v.YearGlobalXlsxView.as_view()),
    path("years/<int:year>/abc", v.YearAbcView.as_view()),
    path("years/<int:year>/countries/<slug:code>", v.YearCountrySheetView.as_view()),
    path("years/<int:year>/countries/<slug:code>.xlsx", v.YearCountrySheetXlsxView.as_view()),
    path("years/<int:year>/export.xlsx", v.YearExportView.as_view()),
    path("imports/", v.ImportListView.as_view()),
    path("imports/<uuid:pk>", v.ImportDetailView.as_view()),
    path("imports/<slug:kind>/template", v.ImportTemplateView.as_view()),
    path("imports/<slug:kind>/preview", v.ImportPreviewView.as_view()),
    path("imports/<slug:kind>/apply", v.ImportApplyView.as_view()),
]
