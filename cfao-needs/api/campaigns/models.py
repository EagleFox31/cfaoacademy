"""Campagne, catalogue de campagne, soumissions et besoins.

Maille de saisie 2027 : **une formation × quatre trimestres × (effectif + lieu)**.
Academix ne stockait qu'un trimestre et un effectif par ligne ; le fichier de
travail 2027 demande les quatre, chacun avec son lieu souhaité (spec §3.1).
"""
from django.db import models
from django.db.models import Q

from core.models import TimeStampedModel, UUIDModel
from referential.models import Brand, CatalogFamily, OrgUnitRef, UserProfile

QUARTERS = ("q1", "q2", "q3", "q4")


class Place(models.TextChoices):
    CFR = "CFR", "Centre régional"
    FILIALE = "FILIALE", "Filiale"


class Campaign(UUIDModel, TimeStampedModel):
    """Un exercice de collecte.

    La clôture est une **date, pas un bouton** : passé `closes_at`, l'API refuse
    toute écriture de besoin, sauf réouverture explicite et tracée.
    """

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Brouillon"
        OPEN = "OPEN", "Ouverte"
        CLOSED = "CLOSED", "Clôturée"
        ARBITRATED = "ARBITRATED", "Arbitrée"
        ARCHIVED = "ARCHIVED", "Archivée"

    year = models.IntegerField(unique=True)
    label = models.CharField(max_length=128)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    opens_at = models.DateTimeField(null=True, blank=True)
    closes_at = models.DateTimeField(null=True, blank=True)
    default_locale = models.CharField(max_length=8, default="fr")

    class Meta:
        ordering = ["-year"]

    def __str__(self) -> str:
        return self.label

    def accepts_entries(self, now) -> bool:
        if self.status != self.Status.OPEN:
            return False
        if self.opens_at and now < self.opens_at:
            return False
        if self.closes_at and now > self.closes_at:
            return False
        return True


class CatalogLine(UUIDModel, TimeStampedModel):
    """Une ligne de catalogue pour une campagne.

    **Clé naturelle `(campaign, family, brand, code)` — jamais `code` seul.**
    Le fichier 2027 compte 261 lignes pour 231 codes distincts : `TP02` existe à
    l'identique sur dix marques. Dédoublonner sur `code` perd 30 lignes, en silence.

    `brand` est nullable (ligne transverse). PostgreSQL ne considérant pas deux NULL
    comme égaux, l'unicité passe par **deux contraintes partielles** — sinon les
    doublons transverses passent.

    Immuable une fois la campagne ouverte : corriger une ligne casserait le lien
    avec les besoins déjà saisis. Une correction crée une nouvelle campagne.
    """

    class Tier(models.TextChoices):
        JUNIOR = "JUNIOR", "Junior"
        SENIOR = "SENIOR", "Senior"
        EXPERT = "EXPERT", "Expert"

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="catalog_lines")
    family = models.ForeignKey(CatalogFamily, on_delete=models.PROTECT, related_name="catalog_lines")
    brand = models.ForeignKey(
        Brand, null=True, blank=True, on_delete=models.PROTECT, related_name="catalog_lines"
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=512)
    tier = models.CharField(max_length=16, choices=Tier.choices, blank=True)
    # Familles de métier visées : MANAGER, FRONT_OFFICE, BACK_OFFICE.
    # La colonne source mélangeait niveau technicien et famille de métier dans un
    # seul champ, avec des séparateurs libres — d'où deux champs distincts ici.
    populations = models.JSONField(default=list)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["family__sort_order", "brand__label", "sort_order", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["campaign", "family", "brand", "code"],
                condition=Q(brand__isnull=False),
                name="uniq_catalog_line_with_brand",
            ),
            models.UniqueConstraint(
                fields=["campaign", "family", "code"],
                condition=Q(brand__isnull=True),
                name="uniq_catalog_line_cross_brand",
            ),
        ]
        indexes = [models.Index(fields=["campaign", "family"])]

    def __str__(self) -> str:
        marque = self.brand.label if self.brand else "toutes marques"
        return f"{self.code} · {marque} · {self.title[:48]}"


class Submission(UUIDModel, TimeStampedModel):
    """La déclaration d'une filiale pour une campagne.

    Le circuit d'états suit le principe « rien ne sort sans relecture » (spec §7) :
    le passage à `SUBMITTED` n'envoie **rien** à la filiale — il notifie l'équipe
    Academy, qui valide, ce qui déclenche alors la confirmation.
    """

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "En saisie"
        SUBMITTED = "SUBMITTED", "En relecture"
        VALIDATED = "VALIDATED", "Validée"
        REOPENED = "REOPENED", "Réouverte"

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="submissions")
    org_unit = models.ForeignKey(OrgUnitRef, on_delete=models.PROTECT, related_name="submissions")
    country = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)

    submitted_by = models.ForeignKey(
        UserProfile, null=True, blank=True, on_delete=models.SET_NULL, related_name="submitted"
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    validated_by = models.ForeignKey(
        UserProfile, null=True, blank=True, on_delete=models.SET_NULL, related_name="validated"
    )
    validated_at = models.DateTimeField(null=True, blank=True)
    reopen_reason = models.TextField(blank=True)

    total_headcount = models.IntegerField(default=0)
    last_activity_at = models.DateTimeField(null=True, blank=True)

    # Machine à états de relance (spec §7.4) — l'état est STOCKÉ, pas recalculé :
    # une relance n'est préparée qu'une fois, même si le worker rejoue.
    class ReminderState(models.TextChoices):
        NONE = "NONE", "Aucune"
        J21 = "J21", "J-21"
        J10 = "J10", "J-10"
        J3 = "J3", "J-3"
        ESCALATED = "ESCALATED", "Escaladée"

    reminder_state = models.CharField(
        max_length=16, choices=ReminderState.choices, default=ReminderState.NONE
    )
    last_reminder_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["org_unit__label"]
        constraints = [
            models.UniqueConstraint(
                fields=["campaign", "org_unit"], name="uniq_submission_per_org_unit"
            )
        ]

    def __str__(self) -> str:
        return f"{self.org_unit.label} · {self.campaign.year}"

    @property
    def is_editable(self) -> bool:
        return self.status in (self.Status.DRAFT, self.Status.REOPENED)

    @property
    def org_path(self) -> list:
        return list(self.org_unit.org_path)


class SubmissionCc(UUIDModel, TimeStampedModel):
    """Destinataires en copie de la confirmation, désignés par l'auteur de la fiche.

    Ces adresses ne reçoivent **rien** tant que l'équipe Academy n'a pas validé.
    """

    class Source(models.TextChoices):
        MANUAL = "MANUAL", "Saisi par l'auteur"
        INHERITED = "INHERITED", "Hérité de la filiale"

    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="cc")
    email = models.EmailField()
    label = models.CharField(max_length=128, blank=True)
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.MANUAL)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["submission", "email"], name="uniq_cc_per_submission")
        ]

    def __str__(self) -> str:
        return self.email


class NeedLine(UUIDModel, TimeStampedModel):
    """Un besoin : une ligne de catalogue × quatre trimestres.

    Une ligne à effectif nul **n'est pas stockée**. Sans cette règle, chaque filiale
    créerait 261 lignes vides et l'export deviendrait illisible.
    """

    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="lines")
    catalog_line = models.ForeignKey(CatalogLine, on_delete=models.PROTECT, related_name="needs")

    q1 = models.PositiveIntegerField(default=0)
    q2 = models.PositiveIntegerField(default=0)
    q3 = models.PositiveIntegerField(default=0)
    q4 = models.PositiveIntegerField(default=0)

    place_q1 = models.CharField(max_length=8, choices=Place.choices, default=Place.CFR)
    place_q2 = models.CharField(max_length=8, choices=Place.choices, default=Place.CFR)
    place_q3 = models.CharField(max_length=8, choices=Place.choices, default=Place.CFR)
    place_q4 = models.CharField(max_length=8, choices=Place.choices, default=Place.CFR)

    comment = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["submission", "catalog_line"], name="uniq_need_per_catalog_line"
            )
        ]
        indexes = [models.Index(fields=["submission"])]

    def __str__(self) -> str:
        return f"{self.catalog_line.code} · {self.total}"

    @property
    def total(self) -> int:
        return self.q1 + self.q2 + self.q3 + self.q4

    @property
    def is_empty(self) -> bool:
        return self.total == 0


class SubmissionEvent(UUIDModel):
    """Journal d'audit de la soumission.

    **Le remplacement total est interdit** — leçon directe d'Academix, où mettre à
    jour une liste la remplaçait entièrement : on perdait qui avait été retiré et
    quand. Ici toute modification d'effectif est un événement, pas un écrasement.
    """

    class Kind(models.TextChoices):
        CREATED = "created", "Créée"
        LINE_CHANGED = "line_changed", "Ligne modifiée"
        CC_CHANGED = "cc_changed", "Destinataires modifiés"
        SUBMITTED = "submitted", "Soumise"
        VALIDATED = "validated", "Validée"
        REOPENED = "reopened", "Réouverte"
        CORRECTED = "corrected", "Corrigée par l'équipe"
        REMINDER_PREPARED = "reminder_prepared", "Relance préparée"

    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="events")
    at = models.DateTimeField(auto_now_add=True)
    # Acteur RÉEL — en saisie déléguée, ce n'est pas le manager mais la personne
    # qui a saisi à sa place (story 16-16).
    actor = models.CharField(max_length=128, blank=True)
    on_behalf_of = models.CharField(max_length=128, blank=True)
    kind = models.CharField(max_length=32, choices=Kind.choices)
    payload = models.JSONField(default=dict)

    class Meta:
        ordering = ["-at"]
        indexes = [models.Index(fields=["submission", "-at"])]

    def __str__(self) -> str:
        return f"{self.kind} · {self.at:%Y-%m-%d %H:%M}"
