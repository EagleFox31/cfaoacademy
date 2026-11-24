"""Référentiel — marques, pays, formateurs, alias, jours fériés, règles d'import.

Ce qui est **stable d'une année à l'autre**. Les sessions et absences vivent dans
`planning`. Les tables d'alias et de règles sont des **données** éditables par un
administrateur, pas du code (patron d'import, règle 6) : le classeur source écrit
« Lucien », « EUGENE EBENE » ou « OMODA & JAECCO », et c'est ici qu'on dit à quoi
chaque graphie correspond.
"""
from django.db import models
from django.db.models import Q

from core.models import TimeStampedModel, UUIDModel


class Pole(models.TextChoices):
    MOTORS = "MOTORS", "Motors"
    EQUIPMENT = "EQUIPMENT", "Equipment"


class Service(models.TextChoices):
    """Les services du classeur (feuille « Menu déroulant »)."""

    MOTORS = "MOTORS", "Motors"
    EQUIPMENT = "EQUIPMENT", "Equipment"
    SAV = "SAV", "SAV"
    CFAO_MOBILITY_CAMEROON = "CFAO_MOBILITY_CAMEROON", "CFAO Mobility Cameroon"


class Brand(UUIDModel, TimeStampedModel):
    """Une marque. Une session transverse n'en a pas (`Session.brand` = NULL)."""

    code = models.SlugField(max_length=48, unique=True)
    label = models.CharField(max_length=96)
    pole = models.CharField(max_length=16, choices=Pole.choices)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["pole", "sort_order", "label"]

    def __str__(self) -> str:
        return self.label


class BrandAlias(UUIDModel, TimeStampedModel):
    """`alias_norm` est la forme normalisée (`referential.normalize.norm_key`)."""

    alias_norm = models.CharField(max_length=96, unique=True)
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name="aliases")
    added_by = models.CharField(max_length=128, blank=True)

    class Meta:
        verbose_name_plural = "brand aliases"

    def __str__(self) -> str:
        return f"{self.alias_norm} → {self.brand.code}"


class Country(UUIDModel, TimeStampedModel):
    """Pays hôte d'une session. `org_path` reprend le format de la plateforme
    (chaîne d'ancêtres) pour que la condition Cerbos `scopeNode ∈ orgPath` soit
    identique des deux côtés.

    « CFR » (CFAO Formation Régionale, Douala) n'est pas un pays ISO : c'est le
    centre Academy, rattaché au Cameroun.
    """

    code = models.SlugField(max_length=16, unique=True)
    label = models.CharField(max_length=96)
    org_path = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["label"]
        verbose_name_plural = "countries"

    def __str__(self) -> str:
        return self.label


class CountryAlias(UUIDModel, TimeStampedModel):
    alias_norm = models.CharField(max_length=96, unique=True)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="aliases")
    added_by = models.CharField(max_length=128, blank=True)

    class Meta:
        verbose_name_plural = "country aliases"

    def __str__(self) -> str:
        return f"{self.alias_norm} → {self.country.code}"


class Trainer(UUIDModel, TimeStampedModel):
    """Un animateur de session : formateur Academy (rôle `trainer`), intervenant
    externe, ou technicien instructeur.

    Un technicien instructeur est un technicien d'un certain niveau habilité à
    animer des formations de son niveau ; ce n'est pas un formateur (pas
    d'hébergement formateur refacturé dans la clé de répartition). Chaque marque
    a son nom pour ce rôle : PIC chez Suzuki, Key Instructor chez Toyota.

    `keycloak_sub` relie la fiche au compte : sans lui, le formateur voit le
    planning général mais pas « ses » sessions (rôle dérivé `own_trainer`).
    """

    class Kind(models.TextChoices):
        TRAINER = "TRAINER", "Formateur"
        TECH_INSTRUCTOR = "TECH_INSTRUCTOR", "Technicien instructeur"

    full_name = models.CharField(max_length=128)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.TRAINER)
    name_norm = models.CharField(max_length=128, unique=True)
    service = models.CharField(max_length=32, choices=Service.choices)
    email = models.EmailField(null=True, blank=True)
    keycloak_sub = models.CharField(max_length=64, null=True, blank=True)
    brands = models.ManyToManyField(Brand, blank=True, related_name="trainers")
    # Pays où le formateur est basé ; vide = l'Academy. Il ne se loge qu'en
    # dehors de ce pays (clé de répartition, SPEC §8).
    home_country = models.ForeignKey(
        Country, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    is_external = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["service", "sort_order", "full_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["email"], condition=Q(email__isnull=False), name="trainer_email_unique"
            ),
            models.UniqueConstraint(
                fields=["keycloak_sub"],
                condition=Q(keycloak_sub__isnull=False),
                name="trainer_sub_unique",
            ),
        ]

    def __str__(self) -> str:
        return self.full_name


class TrainerAlias(UUIDModel, TimeStampedModel):
    """Graphies rencontrées : « Lucien », « EUGENE EBENE », « Thierry TAMO »…

    Jamais de rapprochement flou automatique : un prénom seul peut désigner deux
    personnes. Le flou ne sert qu'à **suggérer** dans le message d'erreur.
    """

    alias_norm = models.CharField(max_length=128, unique=True)
    trainer = models.ForeignKey(Trainer, on_delete=models.CASCADE, related_name="aliases")
    added_by = models.CharField(max_length=128, blank=True)

    class Meta:
        verbose_name_plural = "trainer aliases"

    def __str__(self) -> str:
        return f"{self.alias_norm} → {self.trainer.full_name}"


class Holiday(UUIDModel, TimeStampedModel):
    """Jour férié. `country` NULL = férié pour tous les pays (ex. 1er janvier)."""

    country = models.ForeignKey(
        Country, null=True, blank=True, on_delete=models.CASCADE, related_name="holidays"
    )
    date = models.DateField()
    label = models.CharField(max_length=128)

    class Meta:
        ordering = ["date"]
        constraints = [
            models.UniqueConstraint(
                fields=["country", "date"],
                condition=Q(country__isnull=False),
                name="holiday_country_date_unique",
            ),
            models.UniqueConstraint(
                fields=["date"], condition=Q(country__isnull=True), name="holiday_global_date_unique"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.date} {self.label}"


class ColorRule(UUIDModel, TimeStampedModel):
    """Couleur de fond de la grille → statut et/ou catégorie de session.

    Le classeur n'a pas de colonne statut : le sens est porté par la couleur, et
    il varie d'une feuille à l'autre. La règle est donc une donnée, amorcée depuis
    le rapport `colors_found` d'un premier import, puis éditée par l'Academy.

    `fill_key` : `rgb:FFFFC000`, `theme:7:-0.25` ou `idx:44` — jamais une valeur RGB
    recalculée depuis un thème (elle dépend du thème Office du poste).
    """

    fill_key = models.CharField(max_length=48, unique=True)
    status = models.CharField(max_length=16, blank=True)
    category = models.CharField(max_length=16, blank=True)
    label_fr = models.CharField(max_length=96, blank=True)
    label_en = models.CharField(max_length=96, blank=True)
    added_by = models.CharField(max_length=128, blank=True)

    def __str__(self) -> str:
        return f"{self.fill_key} → {self.status or '-'} / {self.category or '-'}"


class AbsenceKeyword(UUIDModel, TimeStampedModel):
    """Mot-clé de cellule qui désigne une absence (« conges », « recup », « ferie »)."""

    class Kind(models.TextChoices):
        LEAVE = "LEAVE", "Congés"
        RECOVERY = "RECOVERY", "Récupération"
        HOLIDAY = "HOLIDAY", "Jour férié"
        OTHER = "OTHER", "Autre indisponibilité"

    pattern_norm = models.CharField(max_length=64, unique=True)
    kind = models.CharField(max_length=16, choices=Kind.choices)

    def __str__(self) -> str:
        return f"{self.pattern_norm} → {self.kind}"


class UserProfile(UUIDModel, TimeStampedModel):
    """Périmètre d'un compte, en mode `standalone`. Aucune colonne mot de passe :
    Keycloak est seul dépositaire des identifiants (audit Academix, interdit n° 1)."""

    keycloak_sub = models.CharField(max_length=64, unique=True)
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=128)
    roles = models.JSONField(default=list)
    country = models.ForeignKey(
        Country, null=True, blank=True, on_delete=models.SET_NULL, related_name="members"
    )
    brands = models.ManyToManyField(Brand, blank=True, related_name="members")
    locale = models.CharField(max_length=8, default="fr")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["display_name"]

    def __str__(self) -> str:
        return self.display_name

    def scope_nodes(self) -> list[str]:
        """Le nœud le plus précis du pays : `groupe.cmr` couvre ses sessions."""
        return [self.country.org_path[-1]] if self.country and self.country.org_path else []
