import re

from rest_framework import serializers

from .models import MESSAGE_MAX, MESSAGE_MIN, REPONSE_MAX, TYPE_MAX, PortalSuggestion

# Caractères de contrôle refusés dans le type (texte court, affiché tel quel).
CONTROLE = re.compile(r"[\x00-\x1f\x7f]")
# Dans la réponse de l'équipe, seuls les retours à la ligne sont permis.
CONTROLE_SAUF_LIGNE = re.compile(r"[\x00-\x09\x0b-\x1f\x7f]")

SUIVI = (
    "statut", "etape_le", "lue_le", "planifiee_le", "en_ligne_le", "non_retenue_le",
    "echeance", "reponse_equipe",
)
CHAMPS_LECTURE = (
    "id", "created_at", "role_vu", "chemin", "section", "type", "message", "langue",
    "auteur_nom", "auteur_roles", *SUIVI,
)
# Ce que le superadmin choisit ; les dates sont posées par le serveur.
SUIVI_MODIFIABLE = ("statut", "echeance", "reponse_equipe")


class PortalSuggestionSerializer(serializers.ModelSerializer):
    """Création : seuls le portail, la page, la partie, le type, le texte et la langue viennent du client."""

    message = serializers.CharField(min_length=MESSAGE_MIN, max_length=MESSAGE_MAX, trim_whitespace=True)
    section = serializers.CharField(max_length=120, required=False, allow_blank=True, trim_whitespace=True)
    type = serializers.CharField(max_length=TYPE_MAX, required=False, allow_blank=True, trim_whitespace=True)

    def validate_type(self, value):
        if CONTROLE.search(value):
            raise serializers.ValidationError("Caractère non permis.")
        return " ".join(value.split())

    class Meta:
        model = PortalSuggestion
        fields = CHAMPS_LECTURE
        read_only_fields = ("id", "created_at", "auteur_nom", "auteur_roles", *SUIVI)


class SuiviSerializer(serializers.ModelSerializer):
    """Suivi (superadmin) : l'étape, l'échéance et le mot de l'équipe ; rien d'autre ne change."""

    reponse_equipe = serializers.CharField(
        max_length=REPONSE_MAX, required=False, allow_blank=True, trim_whitespace=True,
    )
    echeance = serializers.DateField(required=False, allow_null=True)

    def validate_reponse_equipe(self, value):
        if CONTROLE_SAUF_LIGNE.search(value):
            raise serializers.ValidationError("Caractère non permis.")
        return value

    def validate(self, attrs):
        inst = self.instance
        statut = attrs.get("statut", inst.statut if inst else PortalSuggestion.Statut.NOUVELLE)
        echeance = attrs["echeance"] if "echeance" in attrs else (inst.echeance if inst else None)
        reponse = attrs["reponse_equipe"] if "reponse_equipe" in attrs else (inst.reponse_equipe if inst else "")
        if statut == PortalSuggestion.Statut.PLANIFIEE and not echeance:
            raise serializers.ValidationError({"echeance": "Date prévue obligatoire pour l'étape Planifiée."})
        if statut == PortalSuggestion.Statut.NON_RETENUE and not reponse:
            raise serializers.ValidationError({"reponse_equipe": "Motif obligatoire pour l'étape Non retenue."})
        return attrs

    class Meta:
        model = PortalSuggestion
        fields = CHAMPS_LECTURE
        read_only_fields = tuple(c for c in CHAMPS_LECTURE if c not in SUIVI_MODIFIABLE)
