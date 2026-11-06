"""API de la clé de répartition (SPEC §6, §8 ; cas d'usage 8 à 15).

Chaque vue décide explicitement via Cerbos (default-deny) :
  - `planning_cost_key`      : voir, amorcer, régler, geler la clé ;
  - `planning_country_sheet` : voir les chiffres d'UN pays (périmètre org) — les
    tableaux et exports ne gardent que les pays autorisés ;
  - `planning_import`        : modèles, prévisualisation, application, journal ;
  - `planning_catalog_gap`   : thématiques non choisies.
"""
from __future__ import annotations

import hashlib
import io
from decimal import Decimal

from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authz import cerbos
from core.imports.models import ImportLog
from core.imports.template import build_template
from referential.models import Brand, Country

from .clients.needs import fetch_needs, fetch_unchosen
from .exports import xlsx
from .imports.calendar_grid import CalendarGridImporter
from .imports.data_sheet import COLUMNS as DATA_COLUMNS, DataSheetImporter
from .imports.seat_sheets import COLUMNS as SEAT_COLUMNS, SeatSheetsImporter
from .models import CostKeyYear, FrozenKeyError
from .services.cost_key import Mode, compare
from .services.cost_key_abc import abc_table, consolidate_abc
from .services.cost_key_freeze import FreezeRefused, freeze
from .services.cost_key_global import (
    consolidate, consolidate_sheet, country_sheet, global_table, report_for,
)
from .services.cost_key_setup import SetupError, bootstrap, update
from .services.plan_match import match

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class Conflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "CONFLICT"

    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__({"detail": message, **(details or {})})
        self.default_code = code


class Invalid(APIException):
    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__({"detail": message, **(details or {})})
        self.default_code = code


# ── autorisation ────────────────────────────────────────────────────────────
def _principal(request) -> dict:
    return request.user.to_cerbos()


def _key_attr(key: CostKeyYear | None) -> dict:
    if key is None:
        return {"orgPath": ["groupe"]}
    return {"orgPath": ["groupe"], "year": key.year, "pole": key.pole, "status": key.status}


def allow(request, kind: str, action: str, rid: str = "*", attr: dict | None = None) -> None:
    if not cerbos.check(_principal(request), kind, rid, attr or {}, action):
        raise PermissionDenied()


def visible_countries(request, key: CostKeyYear) -> set[str] | None:
    """Codes pays lisibles ; None = tous (aucune restriction)."""
    countries = list(Country.objects.all())
    allowed = cerbos.check_many(
        _principal(request), "planning_country_sheet",
        [(c.code, {**_key_attr(key), "orgPath": list(c.org_path)}) for c in countries], "view")
    return None if allowed >= {c.code for c in countries} else allowed


# ── sérialisation ───────────────────────────────────────────────────────────
def _n(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    return value


def _key_json(key: CostKeyYear) -> dict:
    return {
        "id": str(key.pk), "year": key.year, "pole": key.pole, "status": key.status,
        "budget": _n(key.budget), "trainee_lodging_cost": _n(key.trainee_lodging_cost),
        "trainer_lodging_cost": _n(key.trainer_lodging_cost),
        "hours_per_session": key.hours_per_session,
        "hourly_rate": _n(key.hourly_rate),
        "enrolled": sorted(key.enrolled_countries.values_list("code", flat=True)),
        "planned_sessions": key.planned_sessions.count(),
        "frozen_at": key.frozen_at, "frozen_by": key.frozen_by,
    }


def _line_json(line) -> dict:
    return {
        "country": line.code, "label": line.label, "enrolled": line.enrolled,
        "seats": line.seats, "academy_seats": line.academy_seats,
        "trainer_sessions": line.trainer_sessions, "share": float(round(line.share, 6)),
        "key_cost": _n(line.key_cost), "trainee_lodging": _n(line.trainee_lodging),
        "trainer_lodging": _n(line.trainer_lodging), "total": _n(line.total),
        "needs": line.needs,
        "coverage": None if line.coverage is None else float(round(line.coverage, 4)),
    }


def _mode(request) -> Mode:
    raw = (request.query_params.get("mode") or "PLANNED").upper()
    try:
        return Mode(raw)
    except ValueError:
        raise Invalid("INVALID_MODE", "mode vaut PLANNED ou ACTUAL.")


def _lang(request) -> str:
    lang = request.query_params.get("lang") or request.user.attr.get("locale", "fr")
    return "en" if str(lang).startswith("en") else "fr"


def _xlsx(content: bytes, filename: str) -> HttpResponse:
    response = HttpResponse(content, content_type=XLSX)
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def _get_key(request, pk, action: str = "view") -> CostKeyYear:
    key = get_object_or_404(CostKeyYear, pk=pk)
    allow(request, "planning_cost_key", action, str(key.pk), _key_attr(key))
    return key


# ── accès (menu par rôle) ───────────────────────────────────────────────────
class AccessView(APIView):
    """Ce que l'utilisateur peut faire : le front n'affiche que ces entrées."""

    def get(self, request):
        p = _principal(request)
        attr = _key_attr(None)
        return Response({
            "view": cerbos.check(p, "planning_cost_key", "*", attr, "view"),
            "manage": cerbos.check(p, "planning_cost_key", "*", attr, "update"),
            "freeze": cerbos.check(p, "planning_cost_key", "*", attr, "freeze"),
            "import": cerbos.check(p, "planning_import", "*", attr, "apply"),
            "gaps": cerbos.check(p, "planning_catalog_gap", "*", attr, "view"),
        })


# ── clés ────────────────────────────────────────────────────────────────────
class CostKeyListView(APIView):
    parser_classes = [JSONParser]

    def get(self, request):
        allow(request, "planning_cost_key", "list", attr=_key_attr(None))
        keys = CostKeyYear.objects.order_by("-year", "pole")
        return Response([_key_json(k) for k in keys])

    def post(self, request):
        """Cas 8 : amorcer la clé d'une année (créer seulement)."""
        allow(request, "planning_cost_key", "create", attr=_key_attr(None))
        try:
            year = int(request.data.get("year"))
        except (TypeError, ValueError):
            raise Invalid("INVALID_YEAR", "year doit être une année.")
        pole = str(request.data.get("pole", "")).upper()
        if pole not in {"MOTORS", "EQUIPMENT"} or not 2000 <= year <= 2100:
            raise Invalid("INVALID_KEY", "year et pole (MOTORS, EQUIPMENT) sont obligatoires.")
        try:
            key, created = bootstrap(year, pole, request.data)
        except SetupError as exc:
            raise Invalid(exc.code, str(exc), exc.details)
        return Response(_key_json(key), status=201 if created else 200)


class CostKeyDetailView(APIView):
    parser_classes = [JSONParser]

    def get(self, request, pk):
        return Response(_key_json(_get_key(request, pk)))

    def patch(self, request, pk):
        key = _get_key(request, pk, "update")
        try:
            update(key, request.data)
        except FrozenKeyError as exc:
            raise Conflict("KEY_FROZEN", str(exc))
        except SetupError as exc:
            raise Invalid(exc.code, str(exc), exc.details)
        key.refresh_from_db()
        return Response(_key_json(key))


class CostKeyReportView(APIView):
    """Cas 10 : calcul de la clé (prévu ou réalisé), pays par pays."""

    def get(self, request, pk):
        key = _get_key(request, pk)
        needs = fetch_needs(key.year, key.pole)
        report = report_for(key, _mode(request), needs.by_country if needs.available else None)
        visible = visible_countries(request, key)
        lines = [l for l in report.lines if visible is None or l.code in visible]
        return Response({
            "year": key.year, "pole": key.pole, "mode": str(report.mode), "status": key.status,
            "budget": _n(report.budget), "total_seats": report.total_seats,
            "hourly_cost": None if report.hourly_cost is None else round(float(report.hourly_cost), 2),
            "needs_source": needs.source, "warnings": needs.warnings,
            "partial": visible is not None, "lines": [_line_json(l) for l in lines],
        })


class CostKeyFreezeView(APIView):
    """Cas 11 : geler le prévu (snapshot de facturation)."""

    def post(self, request, pk):
        key = _get_key(request, pk, "freeze")
        needs = fetch_needs(key.year, key.pole)
        try:
            snapshot = freeze(key, actor=request.user.id,
                              needs=needs.by_country if needs.available else None)
        except FreezeRefused as exc:
            raise Conflict("FREEZE_REFUSED", str(exc))
        key.refresh_from_db()
        return Response({**_key_json(key), "inputs_sha256": snapshot.inputs_sha256})


class CostKeyCompareView(APIView):
    """Cas 12 : prévu face au réalisé, et bilan du lien entre les deux."""

    def get(self, request, pk):
        key = _get_key(request, pk)
        needs = fetch_needs(key.year, key.pole)
        report = compare(key, needs.by_country if needs.available else None)
        visible = visible_countries(request, key)
        lines = [l for l in report.lines if visible is None or l.code in visible]
        return Response({
            "year": key.year, "pole": key.pole, "status": key.status,
            "match": report.match, "partial": visible is not None,
            "lines": [{
                "country": l.code, "label": l.label, "enrolled": l.enrolled,
                "planned_seats": l.planned_seats, "actual_seats": l.actual_seats,
                "delta_seats": l.delta_seats,
                "planned_share": float(round(l.planned_share, 6)),
                "actual_share": float(round(l.actual_share, 6)),
                "planned_key_cost": _n(l.planned_key_cost), "actual_key_cost": _n(l.actual_key_cost),
                "delta_key_cost": _n(l.delta_key_cost),
                "planned_total": _n(l.planned_total), "actual_total": _n(l.actual_total),
                "delta_total": _n(l.delta_total),
            } for l in lines],
        })


class CostKeyMatchView(APIView):
    """Cas 12 : le lien session prévue ↔ réalisée, groupe par groupe."""

    def get(self, request, pk):
        key = _get_key(request, pk)
        groups = match(key)
        brands = Brand.objects.in_bulk({g.brand_id for g in groups})
        hosts = Country.objects.in_bulk({g.host_id for g in groups})
        visible = visible_countries(request, key)
        rows = []
        for g in groups:
            host = hosts.get(g.host_id)
            if visible is not None and (host is None or host.code not in visible):
                continue
            brand = brands.get(g.brand_id)
            rows.append({
                "brand": brand.label if brand else "", "code": g.code_norm,
                "host": host.code if host else "", "host_label": host.label if host else "",
                "planned": g.planned, "actual": g.actual, "status": str(g.status),
            })
        rows.sort(key=lambda r: (r["status"], r["brand"], r["code"]))
        return Response({"partial": visible is not None, "groups": rows})


# ── sorties (cas 13 et 15) ──────────────────────────────────────────────────
def _global(request, key):
    needs = fetch_needs(key.year, key.pole)
    return global_table(key, _mode(request), needs, visible_countries(request, key)), needs


class CostKeyGlobalView(APIView):
    """Cas 13 et 15 : tableau global pays × marque avec la couverture des besoins."""

    def get(self, request, pk):
        key = _get_key(request, pk)
        table, _ = _global(request, key)
        return Response(table)


class CostKeyAbcView(APIView):
    """Vue ABC : Attribué (prévu de la clé), Besoin et Contractuel (cfao-needs)."""

    def get(self, request, pk):
        key = _get_key(request, pk)
        return Response(abc_table(key, fetch_needs(key.year, key.pole),
                                  visible_countries(request, key)))


class YearAbcView(APIView):
    def get(self, request, year):
        keys = _year_keys(request, year)
        tables = [abc_table(k, fetch_needs(k.year, k.pole)) for k in keys]
        return Response(consolidate_abc(tables, _year_visible(request, keys)))


class CostKeyGlobalXlsxView(APIView):
    def get(self, request, pk):
        key = _get_key(request, pk)
        table, _ = _global(request, key)
        return _xlsx(xlsx.global_workbook(table, _lang(request)),
                     f"cle-{key.pole.lower()}-{key.year}-global.xlsx")


def _sheet(request, key, code):
    if Country.objects.filter(code=code).exists():
        visible = visible_countries(request, key)
        if visible is not None and code not in visible:
            raise PermissionDenied()
    needs = fetch_needs(key.year, key.pole)
    sheet = country_sheet(key, _mode(request), code,
                          needs.by_country if needs.available else None)
    if sheet is None:
        raise NotFound()
    return sheet


class CountrySheetView(APIView):
    """Cas 15 : fiche d'un pays (ses sessions et sa facture)."""

    def get(self, request, pk, code):
        return Response(_sheet(request, _get_key(request, pk), code))


class CountrySheetXlsxView(APIView):
    def get(self, request, pk, code):
        key = _get_key(request, pk)
        sheet = _sheet(request, key, code)
        return _xlsx(xlsx.country_workbook(sheet, _lang(request)),
                     f"cle-{key.pole.lower()}-{key.year}-{code}.xlsx")


class CostKeyExportView(APIView):
    """Cas 15 : le classeur complet (GLOBAL + une feuille par pays visible)."""

    def get(self, request, pk):
        key = _get_key(request, pk)
        table, needs = _global(request, key)
        mode = _mode(request)
        by_country = needs.by_country if needs.available else None
        sheets = [country_sheet(key, mode, row["country"], by_country)
                  for row in table["rows"] if row["seats"]]
        return _xlsx(xlsx.full_workbook(table, [s for s in sheets if s], _lang(request)),
                     f"cle-{key.pole.lower()}-{key.year}.xlsx")


# ── vue « tous pôles » d'une année ──────────────────────────────────────────
def _year_keys(request, year: int) -> list[CostKeyYear]:
    """Clés de l'année que l'utilisateur peut voir : 404 sans clé, 403 sans droit."""
    year_keys = list(CostKeyYear.objects.filter(year=year).order_by("pole"))
    if not year_keys:
        raise NotFound()
    keys = [k for k in year_keys if cerbos.check(_principal(request), "planning_cost_key",
                                                str(k.pk), _key_attr(k), "view")]
    if not keys:
        raise PermissionDenied()
    return keys


def _year_visible(request, keys) -> set[str] | None:
    """Un pays n'est lisible que s'il l'est dans chacune des clés (refus par défaut)."""
    restricted = [v for v in (visible_countries(request, k) for k in keys) if v is not None]
    return set.intersection(*restricted) if restricted else None


class _YearScope:
    """Clés lisibles de l'année, besoins et tableaux par pôle : lus une seule fois."""

    def __init__(self, request, year: int):
        self.keys = _year_keys(request, year)
        self.mode = _mode(request)
        self.needs = {k.pk: fetch_needs(k.year, k.pole) for k in self.keys}
        tables = [global_table(k, self.mode, self.needs[k.pk]) for k in self.keys]
        self.visible = _year_visible(request, self.keys)
        self.table = consolidate(tables, self.visible)
        self._rows = {r["country"]: r for r in consolidate(tables)["rows"]}

    def sheet(self, code: str) -> dict:
        row = self._rows.get(code)
        if row is None:
            raise NotFound()
        if self.visible is not None and code not in self.visible:
            raise PermissionDenied()
        sheets = []
        for k in self.keys:
            needs = self.needs[k.pk]
            sheet = country_sheet(k, self.mode, code, needs.by_country if needs.available else None)
            if sheet:
                sheets.append(sheet)
        return consolidate_sheet(sheets, row)


class YearGlobalView(APIView):
    """Tableau global « tous pôles » : les clés de l'année additionnées."""

    def get(self, request, year):
        return Response(_YearScope(request, year).table)


class YearGlobalXlsxView(APIView):
    def get(self, request, year):
        table = _YearScope(request, year).table
        return _xlsx(xlsx.global_workbook(table, _lang(request)), f"cle-tous-{year}-global.xlsx")


class YearCountrySheetView(APIView):
    def get(self, request, year, code):
        return Response(_YearScope(request, year).sheet(code))


class YearCountrySheetXlsxView(APIView):
    def get(self, request, year, code):
        sheet = _YearScope(request, year).sheet(code)
        return _xlsx(xlsx.country_workbook(sheet, _lang(request)), f"cle-tous-{year}-{code}.xlsx")


class YearExportView(APIView):
    def get(self, request, year):
        scope = _YearScope(request, year)
        sheets = [scope.sheet(r["country"]) for r in scope.table["rows"] if r["seats"]]
        return _xlsx(xlsx.full_workbook(scope.table, sheets, _lang(request)), f"cle-tous-{year}.xlsx")


class UnchosenModulesView(APIView):
    """Cas 14 : modules du catalogue qu'aucune filiale n'a demandés."""

    def get(self, request, pk):
        key = get_object_or_404(CostKeyYear, pk=pk)
        allow(request, "planning_catalog_gap", "view", str(key.pk), _key_attr(key))
        return Response({"year": key.year, "pole": key.pole,
                         **fetch_unchosen(key.year, key.pole)})


# ── imports (cas 9) ─────────────────────────────────────────────────────────
IMPORTS = {
    "sessions": {"importer": lambda params: DataSheetImporter(),
                 "template": (DATA_COLUMNS, "Data")},
    "calendar_grid": {"importer": lambda params: CalendarGridImporter(int(params["year"])),
                      "template": None, "params": ("year",)},
    "seat_allocations": {"importer": lambda params: SeatSheetsImporter(),
                         "template": (SEAT_COLUMNS, "Cameroun")},
}


def _import_kind(kind: str) -> dict:
    if kind not in IMPORTS:
        raise NotFound()
    return IMPORTS[kind]


def _upload(request) -> tuple[bytes, str]:
    upload = request.FILES.get("file")
    if upload is None:
        raise Invalid("FILE_REQUIRED", "Joindre le fichier (champ file).")
    if not upload.name.lower().endswith((".xlsx", ".xlsm")):
        raise Invalid("FILE_TYPE", "Seuls les fichiers Excel .xlsx ou .xlsm sont acceptés.")
    if upload.size > settings.IMPORT_MAX_FILE_MB * 1024 * 1024:
        raise Invalid("FILE_TOO_LARGE", f"Fichier limité à {settings.IMPORT_MAX_FILE_MB} Mo.")
    content = upload.read()
    return content, hashlib.sha256(content).hexdigest()


def _params(request, spec: dict) -> dict:
    params = {}
    for name in spec.get("params", ()):
        value = request.data.get(name)
        if value in (None, ""):
            raise Invalid("PARAM_REQUIRED", f"Paramètre {name} obligatoire.", {"param": name})
        try:
            params[name] = int(value)
        except ValueError:
            raise Invalid("PARAM_INVALID", f"{name} doit être un entier.", {"param": name})
    if str(request.data.get("replace", "")).lower() in {"1", "true", "on", "yes"}:
        params["replace"] = True
    return params


def _parse(request, kind: str):
    spec = _import_kind(kind)
    content, sha = _upload(request)
    params = _params(request, spec)
    try:
        importer = spec["importer"](params)
    except ValueError as exc:
        raise Invalid("PARAM_INVALID", str(exc))
    return importer, importer.parse(io.BytesIO(content)), sha, params


def _log_json(log: ImportLog, full: bool = False) -> dict:
    data = {"id": str(log.pk), "kind": log.kind, "status": log.status, "actor": log.actor,
            "rows_written": log.rows_written, "created_at": log.created_at,
            "params": log.params, "file_sha256": log.file_sha256[:12]}
    if full:
        data["report"] = log.report
    else:
        data["rows_rejected"] = log.report.get("rows_rejected", 0)
    return data


class ImportTemplateView(APIView):
    def get(self, request, kind):
        spec = _import_kind(kind)
        allow(request, "planning_import", "template", attr={"kind": kind})
        if not spec["template"]:
            raise NotFound()
        columns, title = spec["template"]
        return _xlsx(build_template(columns, title), f"modele-{kind}.xlsx")


class ImportPreviewView(APIView):
    """Lit le fichier et dit ce qui serait écrit. N'écrit rien."""
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, kind):
        _import_kind(kind)
        allow(request, "planning_import", "preview", attr={"kind": kind})
        _, result, sha, params = _parse(request, kind)
        return Response({**result.as_report(), "file_sha256": sha[:12], "params": params})


class ImportApplyView(APIView):
    """Tout ou rien ; un fichier déjà appliqué n'est jamais réécrit."""
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, kind):
        _import_kind(kind)
        allow(request, "planning_import", "apply", attr={"kind": kind})
        importer, result, sha, params = _parse(request, kind)
        try:
            log = importer.apply(result, actor=request.user.id, file_sha256=sha, params=params)
        except FrozenKeyError as exc:
            raise Conflict("KEY_FROZEN", str(exc))
        code = 200 if log.status == ImportLog.Status.APPLIED else 422
        return Response(_log_json(log, full=True), status=code)


class ImportListView(APIView):
    def get(self, request):
        allow(request, "planning_import", "list")
        logs = ImportLog.objects.filter(kind__in=IMPORTS)
        kind = request.query_params.get("kind")
        if kind:
            logs = logs.filter(kind=kind)
        return Response([_log_json(log) for log in logs[:50]])


class ImportDetailView(APIView):
    def get(self, request, pk):
        log = get_object_or_404(ImportLog, pk=pk, kind__in=IMPORTS)
        allow(request, "planning_import", "view", str(log.pk), {"kind": log.kind})
        return Response(_log_json(log, full=True))
