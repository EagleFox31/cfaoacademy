"""API campagnes, catalogue et soumissions.

Toute vue de liste passe par le **query plan Cerbos** traduit en `Q` Django — jamais
par un filtrage applicatif après coup. Une grille complète ne doit jamais transiter
vers un manager qui n'a droit qu'à ses marques.
"""
from django.db.models import Count, F, Q, Sum
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
from referential.models import Brand, CatalogFamily, Pole, UserProfile

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
from .services.place_rules import resolve_place
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


# Les formations sans marque (« TOUTES MARQUES » à la source) doivent rester
# atteignables dans une navigation par marque, sinon un pan entier du catalogue
# devient invisible. Elles forment une entrée transverse par pôle.
TRANSVERSE = "__transverse__"


def _scoped_catalog(request, campaign):
    """Lignes de catalogue visibles par l'appelant, selon le query plan Cerbos."""
    plan = cerbos.plan(request.user.to_cerbos(), "needs_line", "view")
    scope = plan_to_q(plan, {"brand": "brand__code", "pole": "family__pole"})
    return (
        CatalogLine.objects.filter(campaign=campaign)
        .filter(scope)
        .exclude(family__status=CatalogFamily.Status.HIDDEN)
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def campaign_catalog(request, pk):
    """Référentiel **filtré par query plan Cerbos**.

    Un `team_manager` habilité `peugeot` reçoit les lignes PEUGEOT **plus** les
    lignes sans marque de son pôle. Le filtrage se fait ici, pas dans le navigateur.
    """
    campaign = get_object_or_404(Campaign, pk=pk)
    try:
        lines = _scoped_catalog(request, campaign).select_related("family", "brand")
    except DeniedAll:
        return Response([], status=status.HTTP_200_OK)

    family_key = request.query_params.get("family")
    if family_key:
        lines = lines.filter(family__key=family_key)

    # `brand` est le filtre du parcours en trois écrans : la page marque ne
    # demande que ce qu'elle affiche, au lieu de charger les 261 lignes.
    #
    # `section` accompagne toujours `brand` : une marque figure dans la section
    # technique ET dans la section process, avec des lignes différentes. Sans ce
    # filtre, les deux cartes ouvriraient la même grille et les compteurs
    # annoncés sur la carte ne correspondraient pas à ce qui s'affiche.
    section = request.query_params.get("section")
    if section:
        lines = lines.filter(family__section=section)

    brand = request.query_params.get("brand")
    if brand == TRANSVERSE:
        lines = lines.filter(brand__isnull=True)
        pole = request.query_params.get("pole")
        if pole:
            lines = lines.filter(family__pole=pole)
    elif brand:
        lines = lines.filter(brand__code=brand)

    return Response(CatalogLineSerializer(lines, many=True).data)


def _add_pending_brands(grouped: dict[tuple[str, str], list]) -> None:
    """Complète chaque groupe avec les marques du pôle absentes du catalogue.

    Une marque dont le catalogue n'est pas encore livré — Yamaha aujourd'hui —
    doit rester **visible** : la filiale voit que la marque existe et qu'elle
    arrive, au lieu de croire que le groupe ne la forme pas. Elle est marquée
    `pending`, sans compteur et sans lien : ouvrir une grille vide ferait appeler
    le support.

    On ne complète que les couples (section, pôle) déjà présents au catalogue :
    inventer une carte « Process Carrosserie » parce que le pôle existe créerait
    une entrée qui ne correspond à rien.
    """
    poles_used = {pole for _, pole in grouped}
    by_pole: dict[str, list] = {}
    for brand in Brand.objects.filter(is_active=True, pole__in=poles_used):
        by_pole.setdefault(brand.pole, []).append(brand)

    for (_section, pole), brands in grouped.items():
        known = {brand["code"] for brand in brands}
        for brand in by_pole.get(pole, []):
            if brand.code in known:
                continue
            brands.append(
                {
                    "code": brand.code,
                    "label": brand.label,
                    "is_transverse": False,
                    "trainings": 0,
                    "headcount": 0,
                    "trainings_selected": 0,
                    "sort_order": brand.sort_order,
                    "pending": True,
                }
            )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def campaign_brands(request, pk):
    """Marques groupées par section puis par pôle — l'écran d'entrée du parcours.

    Deux sections : « Formation Technique » et « Organisation SAV Process et Parts ».
    Une même marque apparaît dans les deux, avec des compteurs distincts — ce ne
    sont pas les mêmes formations. Fusionner les deux sous une seule carte ferait
    croire à un total unique et enverrait vers une grille qui ne correspond pas.

    Les compteurs sortent de la **même requête** que la liste des marques :
    annoncer « 42 thèmes » puis n'en servir que douze une fois la marque ouverte
    serait pire que ne rien annoncer. Les deux passent par le même query plan.
    """
    campaign = get_object_or_404(Campaign, pk=pk)
    try:
        lines = _scoped_catalog(request, campaign)
    except DeniedAll:
        return Response([], status=status.HTTP_200_OK)

    available = lines.values(
        "family__section", "family__pole", "brand__code", "brand__label", "brand__sort_order"
    ).annotate(trainings=Count("id"))

    entered: dict[tuple[str, str, str | None], dict] = {}
    submission = _my_submission(request, campaign)
    if submission:
        rows = (
            NeedLine.objects.filter(submission=submission)
            .values(
                "catalog_line__family__section",
                "catalog_line__family__pole",
                "catalog_line__brand__code",
            )
            .annotate(
                headcount=Sum(F("q1") + F("q2") + F("q3") + F("q4")),
                selected=Count("id"),
            )
        )
        for row in rows:
            key = (
                row["catalog_line__family__section"],
                row["catalog_line__family__pole"],
                row["catalog_line__brand__code"],
            )
            entered[key] = row

    grouped: dict[tuple[str, str], list] = {}
    for row in available:
        section = row["family__section"]
        pole = row["family__pole"]
        code = row["brand__code"]
        mine = entered.get((section, pole, code), {})
        grouped.setdefault((section, pole), []).append(
            {
                "code": code or TRANSVERSE,
                "label": row["brand__label"] or "",
                "is_transverse": code is None,
                "trainings": row["trainings"],
                "headcount": mine.get("headcount", 0),
                "trainings_selected": mine.get("selected", 0),
                "sort_order": row["brand__sort_order"] or 0,
                "pending": False,
            }
        )

    _add_pending_brands(grouped)

    payload = []
    for section, section_label in CatalogFamily.Section.choices:
        poles = []
        for pole, pole_label in Pole.choices:
            brands = grouped.get((section, pole))
            if not brands:
                continue
            # Le transverse ferme la liste : c'est un repli, pas une marque.
            brands.sort(key=lambda b: (b["is_transverse"], b["sort_order"], b["label"]))
            poles.append(
                {
                    "pole": pole,
                    "pole_label": pole_label,
                    "trainings": sum(b["trainings"] for b in brands),
                    "headcount": sum(b["headcount"] for b in brands),
                    "brands": brands,
                }
            )
        if poles:
            payload.append(
                {"section": section, "section_label": section_label, "poles": poles}
            )
    return Response(payload)


def _my_submission(request, campaign) -> Submission | None:
    """La fiche de la filiale de l'appelant, sans la créer."""
    profile = _profile(request)
    if not profile or not profile.org_unit_id:
        return None
    return Submission.objects.filter(campaign=campaign, org_unit=profile.org_unit).first()


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def campaign_my_submission(request, pk):
    """Ouvre — ou retrouve — la fiche de la filiale de l'appelant.

    Idempotent, et **sans `org_unit` dans le corps** : la filiale se déduit du
    profil, jamais de ce que le navigateur affirme. Appelé au moment où l'on
    commence réellement à saisir, pour ne pas semer des fiches vides à chaque
    connexion — une fiche vide compte comme « sans nouvelles » dans le pilotage.
    """
    campaign = get_object_or_404(Campaign, pk=pk)
    profile = _profile(request)
    if not profile or not profile.org_unit_id:
        return Response(
            {"detail": "Votre compte n'est rattaché à aucune filiale."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not campaign.accepts_entries(timezone.now()):
        return Response({"detail": "La campagne est fermée."}, status=status.HTTP_409_CONFLICT)

    # La filiale se déduit du profil, mais le droit d'ouvrir une fiche reste une
    # décision du PDP : un rôle en lecture seule ne doit pas en créer une.
    if not cerbos.check(
        request.user.to_cerbos(),
        "needs_submission",
        "_new",
        {"orgPath": profile.scope_nodes(), "status": Submission.Status.DRAFT},
        "create",
    ):
        return Response({"detail": "Ouverture non autorisée."}, status=status.HTTP_403_FORBIDDEN)

    submission, created = Submission.objects.get_or_create(
        campaign=campaign,
        org_unit=profile.org_unit,
        defaults={"country": profile.org_unit.country},
    )
    if created:
        SubmissionEvent.objects.create(
            submission=submission,
            kind=SubmissionEvent.Kind.CREATED,
            actor=profile.email,
            payload={"campaign": campaign.year},
        )
    return Response(
        SubmissionSerializer(submission).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


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
    # Une seule action GET+PATCH : deux `@action` sur le même `url_path` font
    # gagner la première route Django → PATCH reçoit 405 Method Not Allowed.
    @action(detail=True, methods=["get", "patch"])
    def lines(self, request, pk=None):
        if request.method == "GET":
            submission = self.get_object()
            rows = NeedLine.objects.filter(submission=submission).select_related("catalog_line")
            return Response(NeedLineSerializer(rows, many=True).data)
        return self._write_lines(request, pk)

    def _write_lines(self, request, pk=None):
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
            # Cameroun : le lieu suit l'effectif (≤6 Douala, ≥7 agence), même si
            # le client envoie autre chose.
            places = {
                f"place_{q}": resolve_place(
                    submission.country, values[q], item.get(f"place_{q}")
                )
                for q in ("q1", "q2", "q3", "q4")
            }

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
