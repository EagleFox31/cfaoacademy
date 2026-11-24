from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from audit.services import record_audit
from core.authz import cerbos
from core.authz.viewsets import ScopedCerbosViewSet

from .models import PortalSuggestion
from .serializers import PortalSuggestionSerializer, SuiviSerializer


class EnvoiThrottle(UserRateThrottle):
    """20 propositions par heure et par compte."""

    scope = "portal_suggestion"
    rate = "20/hour"

    def get_cache_key(self, request, view):
        # Le principal vient du jeton (pas de modèle User) : clé = son identifiant.
        return self.cache_format % {"scope": self.scope, "ident": request.user.id}

    def allow_request(self, request, view):
        if request.method != "POST":
            return True
        return super().allow_request(request, view)


class PortalSuggestionViewSet(ScopedCerbosViewSet):
    """Propositions de modification des portails — PEP Cerbos (default-deny), sans suppression."""

    cerbos_resource_kind = "portal_suggestion"
    queryset = PortalSuggestion.objects.all()
    http_method_names = ["get", "post", "patch", "head", "options"]
    throttle_classes = [EnvoiThrottle]

    def get_serializer_class(self):
        return SuiviSerializer if self.action == "partial_update" else PortalSuggestionSerializer

    # Le périmètre ne vient jamais du client : la politique ne regarde que les rôles.
    def get_cerbos_target(self, request):
        return "new", {}

    def get_cerbos_object(self, obj):
        return str(obj.pk), {}

    # Nombre de propositions renvoyées à leur auteur (les plus récentes).
    MIENNES_MAX = 20

    @action(detail=False, methods=["get"], url_path="miennes")
    def miennes(self, request):
        """Propositions de l'auteur connecté et leur suivi. Action custom → check Cerbos explicite.

        L'auteur vient du jeton (jamais du client) : chacun ne lit que les siennes.
        """
        if not cerbos.check(request.user.to_cerbos(), self.cerbos_resource_kind, "new", {}, "list_own"):
            raise PermissionDenied()
        qs = PortalSuggestion.objects.filter(auteur_sub=request.user.id)[: self.MIENNES_MAX]
        return Response(PortalSuggestionSerializer(qs, many=True).data)

    def perform_create(self, serializer):
        user = self.request.user
        obj = serializer.save(
            auteur_sub=user.id,
            auteur_nom=getattr(user, "username", "") or "",
            auteur_roles=list(user.roles or []),
        )
        record_audit(
            actor=user, action="portal_suggestion.create", resource_kind="portal_suggestion",
            resource_id=obj.pk, metadata={"role_vu": obj.role_vu, "chemin": obj.chemin},
        )

    def perform_update(self, serializer):
        user = self.request.user
        inst = serializer.instance
        data = serializer.validated_data
        statut = data.get("statut", inst.statut)
        extra = {}
        if statut != inst.statut:
            extra = dates_etape(inst, statut, timezone.now())
            extra["suivie_par"] = user.id
        elif "echeance" in data and data["echeance"] != inst.echeance:
            # Nouvelle date prévue : l'auteur doit la voir comme un changement.
            extra = {"etape_le": timezone.now(), "suivie_par": user.id}
        obj = serializer.save(**extra)
        record_audit(
            actor=user, action="portal_suggestion.update", resource_kind="portal_suggestion",
            resource_id=obj.pk, metadata={"statut": obj.statut},
        )


# Étapes linéaires et leur champ de date (Non retenue est à part).
ETAPES = (
    (PortalSuggestion.Statut.NOUVELLE, None),
    (PortalSuggestion.Statut.LUE, "lue_le"),
    (PortalSuggestion.Statut.PLANIFIEE, "planifiee_le"),
    (PortalSuggestion.Statut.EN_LIGNE, "en_ligne_le"),
)


def dates_etape(inst, statut, maintenant):
    """Dates à poser quand la proposition passe à `statut`.

    Étape linéaire : les étapes atteintes gardent leur date (celles sautées prennent
    « maintenant »), les suivantes sont effacées. Non retenue : lue d'office, puis close.
    Revenir à Envoyée ou Lue efface l'échéance.
    """
    extra = {"etape_le": maintenant, "non_retenue_le": None}
    if statut == PortalSuggestion.Statut.NON_RETENUE:
        extra["non_retenue_le"] = maintenant
        if not inst.lue_le:
            extra["lue_le"] = maintenant
        return extra
    rang = [s for s, _ in ETAPES].index(statut)
    for i, (_, champ) in enumerate(ETAPES):
        if champ is None:
            continue
        if i <= rang:
            extra[champ] = getattr(inst, champ) or maintenant
        else:
            extra[champ] = None
    if rang < [s for s, _ in ETAPES].index(PortalSuggestion.Statut.PLANIFIEE):
        extra["echeance"] = None
    return extra
