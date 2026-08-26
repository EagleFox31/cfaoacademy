"""API campagnes, catalogue et soumissions.

Toute vue de liste passe par le **query plan Cerbos** traduit en `Q` Django — jamais
par un filtrage applicatif après coup. Une grille complète ne doit jamais transiter
vers un manager qui n'a droit qu'à ses marques.
"""
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.authz import cerbos
from core.authz.filters import DeniedAll, plan_to_q
from core.authz.permissions import CerbosPermission
from referential.models import CatalogFamily, UserProfile

from .imports.catalog import COLUMNS, EXAMPLE_ROW, CatalogImporter
from .models import Campaign, CatalogLine, NeedLine, Submission, SubmissionCc, SubmissionEvent
from .serializers import (
    CampaignSerializer,
    CatalogLineSerializer,
    NeedLineSerializer,
    NeedLineWriteSerializer,
    SubmissionCcSerializer,
    SubmissionEventSerializer,
    SubmissionSerializer,
)
from .services.summary import campaign_summary as compute_campaign_summary
from .services.summary import refresh_total, submission_summary
from .services.transitions import TransitionRefused, reopen, submit, validate


def _profile(request) -> UserProfile | None:
    return UserProfile.objects.filter(keycloak_sub=request.user.id).first()


class CampaignViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "needs_campaign"
    queryset = Campaign.objects.all()
    serializer_class = CampaignSerializer

    @action(detail=True, methods=["post"])
    def open(self, request, pk=None):
        campaign = self.get_object()
        campaign.status = Campaign.Status.OPEN
        campaign.opens_at = campaign.opens_at or timezone.now()
        campaign.save(update_fields=["status", "opens_at", "updated_at"])
        return Response(CampaignSerializer(campaign).data)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        campaign = self.get_object()
        campaign.status = Campaign.Status.CLOSED
        campaign.save(update_fields=["status", "updated_at"])
        return Response(CampaignSerializer(campaign).data)

    @action(detail=True, methods=["get"])
    def families(self, request, pk=None):
        """Familles + statut : une famille `PENDING` s'affiche mais ne se saisit pas."""
        from referential.serializers import CatalogFamilySerializer

        families = CatalogFamily.objects.exclude(status=CatalogFamily.Status.HIDDEN)
        return Response(CatalogFamilySerializer(families, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def campaign_catalog(request, pk):
    """Référentiel **filtré par query plan Cerbos**.

    Un `team_manager` habilité `peugeot` reçoit les lignes PEUGEOT **plus** les
    lignes sans marque de son pôle. Le filtrage se fait ici, pas dans le navigateur.
    """
    campaign = get_object_or_404(Campaign, pk=pk)
    plan = cerbos.plan(request.user.to_cerbos(), "needs_line", "view")
    try:
        scope = plan_to_q(plan, {"brand": "brand__code", "pole": "family__pole"})
    except DeniedAll:
        return Response([], status=status.HTTP_200_OK)

    lines = (
        CatalogLine.objects.filter(campaign=campaign)
        .filter(scope)
        .exclude(family__status=CatalogFamily.Status.HIDDEN)
        .select_related("family", "brand")
    )
    family_key = request.query_params.get("family")
    if family_key:
        lines = lines.filter(family__key=family_key)
    return Response(CatalogLineSerializer(lines, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def campaign_summary(request, pk):
    campaign = get_object_or_404(Campaign, pk=pk)
    if not cerbos.check(request.user.to_cerbos(), "needs_campaign", str(campaign.id), {}, "view"):
        return Response({"detail": "Accès refusé."}, status=status.HTTP_403_FORBIDDEN)
    return Response(compute_campaign_summary(campaign))


class SubmissionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CerbosPermission]
    cerbos_resource_kind = "needs_submission"
    serializer_class = SubmissionSerializer

    def get_queryset(self):
        plan = cerbos.plan(self.request.user.to_cerbos(), "needs_submission", "view")
        try:
            scope = plan_to_q(plan, {"orgPath": "org_unit__org_path"})
        except DeniedAll:
            return Submission.objects.none()
        return (
            Submission.objects.filter(scope)
            .select_related("org_unit", "campaign", "submitted_by")
            .prefetch_related("cc")
        )

    def get_cerbos_target(self, request):
        return "*", {"orgPath": request.user.attr.get("scopeNodes", [])}

    def get_cerbos_object(self, obj):
        return str(obj.id), {"orgPath": obj.org_path, "status": obj.status}

    # ── grille de saisie ─────────────────────────────────────────────────────
    @action(detail=True, methods=["get"])
    def lines(self, request, pk=None):
        submission = self.get_object()
        lines = NeedLine.objects.filter(submission=submission).select_related("catalog_line")
        return Response(NeedLineSerializer(lines, many=True).data)

    @action(detail=True, methods=["patch"], url_path="lines")
    def write_lines(self, request, pk=None):
        """Écriture incrémentale — brouillon serveur, débounce côté client.

        Une ligne qui retombe à zéro sur les quatre trimestres est **supprimée** :
        261 lignes vides par filiale rendraient l'export illisible. La suppression
        est tracée comme un événement.
        """
        submission = self.get_object()
        if not submission.is_editable:
            return Response(
                {"detail": "Cette fiche n'est plus modifiable."},
                status=status.HTTP_409_CONFLICT,
            )
        if not submission.campaign.accepts_entries(timezone.now()):
            return Response(
                {"detail": "La campagne est fermée."}, status=status.HTTP_409_CONFLICT
            )

        payload = NeedLineWriteSerializer(data=request.data, many=True)
        payload.is_valid(raise_exception=True)

        actor = _profile(request)
        touched = 0
        for item in payload.validated_data:
            line = CatalogLine.objects.filter(
                campaign=submission.campaign, id=item["catalog_line"]
            ).select_related("family").first()
            if not line:
                continue
            if not line.family.is_open:
                continue  # famille PENDING : non saisissable

            values = {q: item[q] for q in ("q1", "q2", "q3", "q4")}
            places = {f"place_{q}": item[f"place_{q}"] for q in ("q1", "q2", "q3", "q4")}

            if sum(values.values()) == 0:
                deleted, _ = NeedLine.objects.filter(
                    submission=submission, catalog_line=line
                ).delete()
                if deleted:
                    touched += 1
                    SubmissionEvent.objects.create(
                        submission=submission,
                        kind=SubmissionEvent.Kind.LINE_CHANGED,
                        actor=getattr(actor, "email", ""),
                        payload={"catalog_line": line.code, "removed": True},
                    )
                continue

            need, created = NeedLine.objects.update_or_create(
                submission=submission,
                catalog_line=line,
                defaults={**values, **places, "comment": item.get("comment", "")},
            )
            touched += 1
            SubmissionEvent.objects.create(
                submission=submission,
                kind=SubmissionEvent.Kind.LINE_CHANGED,
                actor=getattr(actor, "email", ""),
                payload={
                    "catalog_line": line.code,
                    "created": created,
                    **values,
                    **places,
                },
            )

        submission.last_activity_at = timezone.now()
        submission.save(update_fields=["last_activity_at", "updated_at"])
        refresh_total(submission)
        return Response({"touched": touched, "summary": submission_summary(submission)})

    # ── destinataires en copie ───────────────────────────────────────────────
    @action(detail=True, methods=["get", "put"])
    def cc(self, request, pk=None):
        submission = self.get_object()
        if request.method == "GET":
            return Response(SubmissionCcSerializer(submission.cc.all(), many=True).data)

        emails = request.data if isinstance(request.data, list) else request.data.get("cc", [])
        submission.cc.all().delete()
        SubmissionCc.objects.bulk_create(
            [
                SubmissionCc(
                    submission=submission,
                    email=item["email"],
                    label=item.get("label", ""),
                    source=item.get("source", SubmissionCc.Source.MANUAL),
                )
                for item in emails
                if item.get("email")
            ]
        )
        SubmissionEvent.objects.create(
            submission=submission,
            kind=SubmissionEvent.Kind.CC_CHANGED,
            actor=getattr(_profile(request), "email", ""),
            payload={"count": submission.cc.count()},
        )
        return Response(SubmissionCcSerializer(submission.cc.all(), many=True).data)

    # ── transitions ──────────────────────────────────────────────────────────
    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        return Response(submission_summary(self.get_object()))

    @action(detail=True, methods=["get"])
    def events(self, request, pk=None):
        submission = self.get_object()
        return Response(SubmissionEventSerializer(submission.events.all()[:200], many=True).data)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        submission = self.get_object()
        try:
            submit(submission, _profile(request), request.data.get("on_behalf_of", ""))
        except TransitionRefused as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(SubmissionSerializer(submission).data)

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        """Réservé à l'équipe Academy — jamais à un rôle de filiale."""
        submission = self.get_object()
        if not self._may_review(request, submission, "validate"):
            return Response({"detail": "Validation non autorisée."}, status=status.HTTP_403_FORBIDDEN)
        try:
            validate(submission, _profile(request))
        except TransitionRefused as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(SubmissionSerializer(submission).data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        submission = self.get_object()
        if not self._may_review(request, submission, "reopen"):
            return Response({"detail": "Réouverture non autorisée."}, status=status.HTTP_403_FORBIDDEN)
        try:
            reopen(submission, _profile(request), request.data.get("reason", ""))
        except TransitionRefused as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SubmissionSerializer(submission).data)

    def _may_review(self, request, submission, action_name: str) -> bool:
        return cerbos.check(
            request.user.to_cerbos(),
            "needs_submission",
            str(submission.id),
            {"orgPath": submission.org_path, "status": submission.status},
            action_name,
        )


# ── imports ──────────────────────────────────────────────────────────────────


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def catalog_template(request):
    """Modèle vierge — généré depuis la même définition de colonnes que le parseur."""
    from core.imports.template import build_template

    content = build_template(COLUMNS, "Catalogue", EXAMPLE_ROW)
    response = HttpResponse(
        content,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = 'attachment; filename="modele-catalogue.xlsx"'
    return response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def catalog_import(request):
    """Import du référentiel. `preview=1` ne touche pas la base (patron, règle 4)."""
    campaign_id = request.data.get("campaign")
    campaign = get_object_or_404(Campaign, pk=campaign_id)
    if not cerbos.check(
        request.user.to_cerbos(), "needs_campaign", str(campaign.id), {}, "import"
    ):
        return Response({"detail": "Import non autorisé."}, status=status.HTTP_403_FORBIDDEN)
    if campaign.status != Campaign.Status.DRAFT:
        return Response(
            {
                "detail": (
                    "Le catalogue ne peut plus être importé sur une campagne ouverte : "
                    "les besoins déjà saisis y sont rattachés."
                )
            },
            status=status.HTTP_409_CONFLICT,
        )

    upload = request.FILES.get("file")
    if not upload:
        return Response({"detail": "Aucun fichier reçu."}, status=status.HTTP_400_BAD_REQUEST)

    importer = CatalogImporter(campaign)
    result = importer.parse(upload)
    if request.data.get("preview") in ("1", "true", True):
        return Response(result.as_report())

    log = importer.apply(result, actor=request.user.id)
    http_status = status.HTTP_200_OK if result.ok else status.HTTP_422_UNPROCESSABLE_ENTITY
    return Response({"import_id": str(log.id), **result.as_report()}, status=http_status)
