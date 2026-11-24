from django.core.validators import MaxLengthValidator, MinLengthValidator, RegexValidator
from django.db import models

from core.models import TimeStampedModel, UUIDModel

# Portails qu'on peut ouvrir en aperçu (miroir de ROLES_APERCU côté front).
ROLES_PORTAIL = (
    "group_admin", "group_director", "group_hr", "regional_director", "branch_director",
    "dps", "dop", "branch_hr", "branch_admin", "workshop_manager", "team_manager",
    "ki", "pic", "technical_expert", "trainer", "center_director", "training_coordinator",
    "center_assistant", "learner",
)
LANGUES = ("fr", "en", "pt")
MESSAGE_MIN, MESSAGE_MAX = 10, 2000
TYPE_MAX = 60
REPONSE_MAX = 500


class PortalSuggestion(UUIDModel, TimeStampedModel):
    """Proposition de modification d'un portail, faite depuis son aperçu.

    Pas de périmètre org : rien n'est lu du client pour décider qui la voit
    (création : directeur du centre et superadmin ; lecture et suivi : superadmin).
    L'auteur est rempli par le serveur depuis le jeton.

    Suivi par étapes : Envoyée → Lue → Planifiée (échéance) → En ligne,
    ou Non retenue (motif). Chaque étape garde sa date de passage.
    """

    class Statut(models.TextChoices):
        NOUVELLE = "nouvelle", "Envoyée"
        LUE = "lue", "Lue"
        PLANIFIEE = "planifiee", "Planifiée"
        EN_LIGNE = "en_ligne", "En ligne"
        NON_RETENUE = "non_retenue", "Non retenue"

    role_vu = models.CharField(max_length=40, choices=[(r, r) for r in ROLES_PORTAIL])
    chemin = models.CharField(max_length=200, validators=[RegexValidator(r"^/[\w\-/]*$")])
    section = models.CharField(max_length=120, blank=True)
    # Code d'un type proposé (ex. « ajout_kpi ») ou texte libre saisi par l'auteur.
    type = models.CharField(max_length=TYPE_MAX, blank=True)
    message = models.TextField(validators=[MinLengthValidator(MESSAGE_MIN), MaxLengthValidator(MESSAGE_MAX)])
    langue = models.CharField(max_length=2, choices=[(lg, lg) for lg in LANGUES], default="fr")

    auteur_sub = models.CharField(max_length=64)
    auteur_nom = models.CharField(max_length=150, blank=True)
    auteur_roles = models.JSONField(default=list)

    statut = models.CharField(max_length=12, choices=Statut.choices, default=Statut.NOUVELLE)
    # Dernier superadmin ayant changé l'étape, et date de ce changement.
    suivie_par = models.CharField(max_length=64, blank=True)
    etape_le = models.DateTimeField(null=True, blank=True)
    # Dates de passage par étape (vides tant que l'étape n'est pas atteinte).
    lue_le = models.DateTimeField(null=True, blank=True)
    planifiee_le = models.DateTimeField(null=True, blank=True)
    en_ligne_le = models.DateTimeField(null=True, blank=True)
    non_retenue_le = models.DateTimeField(null=True, blank=True)
    # « Prévue d'ici le … » (étape Planifiée) et mot de l'équipe (motif si Non retenue).
    echeance = models.DateField(null=True, blank=True)
    reponse_equipe = models.TextField(blank=True, validators=[MaxLengthValidator(REPONSE_MAX)])

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.role_vu} {self.chemin}"
