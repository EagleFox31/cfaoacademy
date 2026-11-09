"""Planning des formateurs — sessions, affectations, absences, file de revue.

Source maîtresse : la feuille « Data » (tableau plat) crée les sessions. La grille
calendrier n'écrit que des absences, des statuts déduits de la couleur, et des
éléments de revue ; elle ne crée jamais de session sans validation humaine
(docs/SPEC_PLANNING_FORMATEURS.md §4).
"""
from django.db import models
from django.db.models import F, Q
from django.db.models.signals import m2m_changed

from core.models import TimeStampedModel, UUIDModel
from referential.models import AbsenceKeyword, Brand, Country, Pole, Service, Trainer


class SessionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Proposée"
    PLANNED = "PLANNED", "Planifiée"
    IN_PROGRESS = "IN_PROGRESS", "En cours"
    DONE = "DONE", "Réalisée"
    POSTPONED = "POSTPONED", "Reportée"
    CANCELLED = "CANCELLED", "Annulée"


# Statuts qui n'occupent plus le formateur : exclus des conflits.
INACTIVE_STATUSES = (SessionStatus.POSTPONED, SessionStatus.CANCELLED)


class TrainingType(models.TextChoices):
    TECHNIQUE = "TECHNIQUE", "Technique"
    PROCESS_SAV = "PROCESS_SAV", "Process SAV"
    PIECES = "PIECES", "Pièces"


class DeliveryMode(models.TextChoices):
    PRESENTIEL = "PRESENTIEL", "Présentiel"
    DISTANCIEL = "DISTANCIEL", "Distanciel"
    ELEARNING = "ELEARNING", "E-learning"


class Category(models.TextChoices):
    NORMAL = "NORMAL", "Formation Academy"
    MANUFACTURER = "MANUFACTURER", "Formation constructeur"
    CLIENT = "CLIENT", "Formation client"
    TRAIN_THE_TRAINER = "TTT", "Formation de formateurs"
    OTHER = "OTHER", "Autre"


class Origin(models.TextChoices):
    DATA = "DATA", "Import feuille Data"
    GRID = "GRID", "Import de la grille"
    GRID_REVIEW = "GRID_REVIEW", "Grille, validée en revue"
    MANUAL = "MANUAL", "Saisie"


class Session(UUIDModel, TimeStampedModel):
    year = models.PositiveSmallIntegerField()
    brand = models.ForeignKey(
        Brand, null=True, blank=True, on_delete=models.PROTECT, related_name="sessions"
    )
    training_type = models.CharField(max_length=16, choices=TrainingType.choices)
    code_norm = models.CharField(max_length=48)
    code_raw = models.CharField(max_length=64, blank=True)
    reference = models.CharField(max_length=96, blank=True)
    title = models.CharField(max_length=255)
    title_en = models.CharField(max_length=255, blank=True)
    delivery_mode = models.CharField(
        max_length=16, choices=DeliveryMode.choices, default=DeliveryMode.PRESENTIEL
    )
    service = models.CharField(max_length=32, choices=Service.choices, blank=True)
    country = models.ForeignKey(Country, on_delete=models.PROTECT, related_name="sessions")
    location = models.CharField(max_length=96, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    days = models.PositiveSmallIntegerField(default=1)
    hours_per_session = models.PositiveSmallIntegerField(null=True, blank=True)
    seats = models.PositiveSmallIntegerField(null=True, blank=True)
    total_hours = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(
        max_length=16, choices=SessionStatus.choices, default=SessionStatus.PLANNED
    )
    category = models.CharField(max_length=16, choices=Category.choices, default=Category.NORMAL)
    postponed_from = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="postponed_to"
    )
    origin = models.CharField(max_length=16, choices=Origin.choices, default=Origin.MANUAL)
    last_import = models.ForeignKey(
        "core.ImportLog", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    # Périmètre Cerbos dénormalisé depuis le pays hôte (query plan sur liste).
    org_path = models.JSONField(default=list)
    version = models.PositiveIntegerField(default=1)
    override_reason = models.CharField(max_length=255, blank=True)
    created_by = models.CharField(max_length=128, blank=True)

    trainers = models.ManyToManyField(
        Trainer, through="SessionAssignment", related_name="sessions"
    )

    class Meta:
        ordering = ["start_date", "code_norm"]
        constraints = [
            models.CheckConstraint(check=Q(end_date__gte=F("start_date")), name="session_dates_ok"),
            models.CheckConstraint(check=Q(days__gt=0), name="session_days_positive"),
            # Clé d'idempotence d'import : un même module (TS03) revient plusieurs
            # fois dans l'année, d'où la date de début et le pays dans la clé.
            # Deux index partiels car NULL ≠ NULL en SQL (sessions transverses).
            models.UniqueConstraint(
                fields=["year", "brand", "code_norm", "start_date", "country"],
                condition=Q(brand__isnull=False),
                name="session_natural_key",
            ),
            models.UniqueConstraint(
                fields=["year", "code_norm", "start_date", "country"],
                condition=Q(brand__isnull=True),
                name="session_natural_key_transverse",
            ),
        ]
        indexes = [
            models.Index(fields=["start_date", "end_date"]),
            models.Index(fields=["country", "start_date"]),
            models.Index(fields=["year", "brand"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"{self.code_norm} {self.start_date:%d/%m/%Y} {self.country.code}"

    def save(self, *args, **kwargs):
        if self.country_id and not self.org_path:
            self.org_path = list(self.country.org_path)
        super().save(*args, **kwargs)


class SessionAssignment(UUIDModel, TimeStampedModel):
    class Role(models.TextChoices):
        LEAD = "LEAD", "Formateur principal"
        CO = "CO", "Co-animateur"

    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="assignments")
    trainer = models.ForeignKey(Trainer, on_delete=models.PROTECT, related_name="assignments")
    role = models.CharField(max_length=8, choices=Role.choices, default=Role.LEAD)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["session", "trainer"], name="assignment_unique")
        ]
        indexes = [models.Index(fields=["trainer", "session"])]


class SeatAllocation(UUIDModel, TimeStampedModel):
    """Places réalisées d'une session, attribuées à un pays. Le prévisionnel vit à
    part, dans `PlannedAllocation` (SPEC §8 « Prévu et réalisé »)."""

    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="allocations")
    country = models.ForeignKey(Country, on_delete=models.PROTECT, related_name="allocations")
    seats = models.PositiveSmallIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["session", "country"], name="allocation_unique"),
            models.CheckConstraint(check=Q(seats__gt=0), name="allocation_seats_positive"),
        ]
        indexes = [models.Index(fields=["country", "session"])]

    def __str__(self) -> str:
        return f"{self.session} → {self.country.code} × {self.seats}"


class FrozenKeyError(Exception):
    """Écriture refusée : la clé de répartition est gelée, son prévu est immuable."""


class CostKeyStatus(models.TextChoices):
    DRAFT = "DRAFT", "En préparation"
    FROZEN = "FROZEN", "Gelée"


class CostKeyYear(UUIDModel, TimeStampedModel):
    """Paramètres annuels de la clé de répartition, par pôle.

    Les pays enrôlés sont propres à l'année : un pays entré en 2026 ne change
    pas la clé de 2025. Une fois gelée, la clé ne change plus : elle porte le
    prévisionnel sur lequel se fait la refacturation.
    """

    FROZEN_FIELDS = ("year", "pole", "budget", "trainee_lodging_cost", "trainer_lodging_cost",
                     "hours_per_session", "hourly_rate", "status")

    year = models.PositiveSmallIntegerField()
    pole = models.CharField(max_length=16, choices=Pole.choices)
    budget = models.DecimalField(max_digits=14, decimal_places=0)
    trainee_lodging_cost = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    trainer_lodging_cost = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    hours_per_session = models.PositiveSmallIntegerField(default=40)
    # Taux horaire de formation saisi (par technicien et par heure). Affiché à côté
    # du coût horaire calculé (budget / (places × heures)) : il n'entre pas dans la part.
    hourly_rate = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True)
    enrolled_countries = models.ManyToManyField(Country, related_name="cost_key_years")
    status = models.CharField(max_length=8, choices=CostKeyStatus.choices,
                              default=CostKeyStatus.DRAFT)
    frozen_at = models.DateTimeField(null=True, blank=True)
    frozen_by = models.CharField(max_length=128, blank=True)

    class Meta:
        ordering = ["-year", "pole"]
        constraints = [
            models.UniqueConstraint(fields=["year", "pole"], name="cost_key_year_unique"),
            models.CheckConstraint(check=Q(hours_per_session__gt=0),
                                   name="cost_key_hours_positive"),
        ]

    def __str__(self) -> str:
        return f"Clé {self.year} {self.pole}"

    @property
    def is_frozen(self) -> bool:
        return self.status == CostKeyStatus.FROZEN

    def save(self, *args, **kwargs):
        # L'état en base fait foi : une instance périmée ne contourne pas le gel.
        stored = (CostKeyYear.objects.filter(pk=self.pk).values(*self.FROZEN_FIELDS).first()
                  if not self._state.adding else None)
        if stored and stored["status"] == CostKeyStatus.FROZEN:
            if any(getattr(self, f) != v for f, v in stored.items()):
                raise FrozenKeyError(f"{self} est gelée : paramètres non modifiables.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if _frozen(CostKeyYear.objects.filter(pk=self.pk)):
            raise FrozenKeyError(f"{self} est gelée : suppression refusée.")
        return super().delete(*args, **kwargs)


def _frozen(keys) -> bool:
    return keys.filter(status=CostKeyStatus.FROZEN).exists()


class FrozenGuardQuerySet(models.QuerySet):
    """`update` et `delete` en masse refusés dès qu'une ligne relève d'une clé gelée.
    Le SQL brut et `bulk_create` y échappent : le snapshot reste la garantie."""

    key_path = ""

    def _guard(self):
        if self.filter(**{f"{self.key_path}__status": CostKeyStatus.FROZEN}).exists():
            raise FrozenKeyError("Clé de répartition gelée : prévu non modifiable.")

    def update(self, **kwargs):
        self._guard()
        return super().update(**kwargs)

    def delete(self):
        self._guard()
        return super().delete()


class PlannedSessionQuerySet(FrozenGuardQuerySet):
    key_path = "cost_key"


class PlannedAllocationQuerySet(FrozenGuardQuerySet):
    key_path = "planned_session__cost_key"


class PlannedSession(UUIDModel, TimeStampedModel):
    """Session du prévisionnel, lue dans les feuilles pays du classeur clé.

    Elle ne rejoint jamais `Session` : conflits, calendrier et réalisé ne la voient
    pas. Le lien avec le réalisé est calculé (`services/plan_match.py`).
    """

    cost_key = models.ForeignKey(CostKeyYear, on_delete=models.PROTECT,
                                 related_name="planned_sessions")
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name="planned_sessions")
    code_norm = models.CharField(max_length=48)
    code_raw = models.CharField(max_length=64, blank=True)
    title = models.CharField(max_length=255, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    location = models.CharField(max_length=96, blank=True)
    # Pays hôte. Même nom que `Session.country` : le calcul de la clé les lit pareil.
    country = models.ForeignKey(Country, on_delete=models.PROTECT,
                                related_name="planned_sessions")
    trainers = models.ManyToManyField(Trainer, blank=True, related_name="planned_sessions")
    trainers_raw = models.CharField(max_length=255, blank=True)
    last_import = models.ForeignKey(
        "core.ImportLog", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    objects = PlannedSessionQuerySet.as_manager()

    class Meta:
        ordering = ["start_date", "code_norm"]
        constraints = [
            models.UniqueConstraint(
                fields=["cost_key", "brand", "code_norm", "start_date", "country"],
                name="planned_session_identity",
            ),
            models.CheckConstraint(
                check=Q(end_date__isnull=True) | Q(end_date__gte=F("start_date")),
                name="planned_session_dates_ok",
            ),
        ]

    def __str__(self) -> str:
        start = f"{self.start_date:%d/%m/%Y}" if self.start_date else "sans date"
        return f"{self.code_norm} {start} {self.country.code} (prévu)"

    def _guard(self):
        if _frozen(CostKeyYear.objects.filter(pk=self.cost_key_id)):
            raise FrozenKeyError(f"Clé gelée : {self} non modifiable.")

    def save(self, *args, **kwargs):
        self._guard()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        self._guard()
        return super().delete(*args, **kwargs)


class PlannedAllocation(UUIDModel, TimeStampedModel):
    """Places prévues d'un pays sur une session du prévisionnel."""

    planned_session = models.ForeignKey(PlannedSession, on_delete=models.CASCADE,
                                        related_name="allocations")
    country = models.ForeignKey(Country, on_delete=models.PROTECT,
                                related_name="planned_allocations")
    seats = models.PositiveSmallIntegerField()

    objects = PlannedAllocationQuerySet.as_manager()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["planned_session", "country"],
                                    name="planned_allocation_unique"),
            models.CheckConstraint(check=Q(seats__gt=0), name="planned_allocation_seats_positive"),
        ]

    def __str__(self) -> str:
        return f"{self.planned_session} → {self.country.code} × {self.seats}"

    def _guard(self):
        if _frozen(CostKeyYear.objects.filter(planned_sessions=self.planned_session_id)):
            raise FrozenKeyError(f"Clé gelée : {self} non modifiable.")

    def save(self, *args, **kwargs):
        self._guard()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        self._guard()
        return super().delete(*args, **kwargs)


class CostKeySnapshotQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise FrozenKeyError("Snapshot de clé immuable.")

    def delete(self):
        raise FrozenKeyError("Snapshot de clé immuable.")


class CostKeySnapshot(UUIDModel, TimeStampedModel):
    """Rapport de la clé pris au gel : la base de la refacturation.

    Le calcul dépend du référentiel, qui reste modifiable (type de formateur, pays
    d'attache, alias, site de l'Academy) : sans ce rapport figé, recalculer le
    prévu d'une clé gelée pourrait donner un autre montant.
    """

    cost_key = models.OneToOneField(CostKeyYear, on_delete=models.PROTECT,
                                    related_name="snapshot")
    report = models.JSONField()
    needs = models.JSONField(default=dict)
    inputs_sha256 = models.CharField(max_length=64)
    engine_version = models.PositiveSmallIntegerField()
    created_by = models.CharField(max_length=128, blank=True)

    objects = CostKeySnapshotQuerySet.as_manager()

    def __str__(self) -> str:
        return f"Snapshot {self.cost_key}"

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise FrozenKeyError("Snapshot de clé immuable.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise FrozenKeyError("Snapshot de clé immuable.")


def _guard_m2m(keys_of):
    """Garde de gel d'une relation M2M ; `keys_of(instance, reverse, pk_set)` donne
    les clés concernées."""

    def handler(sender, instance, action, reverse, pk_set, **kwargs):
        if action not in ("pre_add", "pre_remove", "pre_clear"):
            return
        if action != "pre_clear" and not pk_set:
            return
        if _frozen(keys_of(instance, reverse, pk_set)):
            raise FrozenKeyError("Clé de répartition gelée : relation non modifiable.")

    return handler


def _enrolled_keys(instance, reverse, pk_set):
    if not reverse:
        return CostKeyYear.objects.filter(pk=instance.pk)
    if pk_set is None:  # country.cost_key_years.clear()
        return instance.cost_key_years.all()
    return CostKeyYear.objects.filter(pk__in=pk_set)


def _trainer_keys(instance, reverse, pk_set):
    if not reverse:
        return CostKeyYear.objects.filter(planned_sessions=instance.pk)
    sessions = (instance.planned_sessions.all() if pk_set is None
                else PlannedSession.objects.filter(pk__in=pk_set))
    return CostKeyYear.objects.filter(planned_sessions__in=sessions)


# Expéditeurs nommés : les modèles intermédiaires n'existent qu'au chargement des apps.
m2m_changed.connect(_guard_m2m(_enrolled_keys), sender="planning.CostKeyYear_enrolled_countries",
                    dispatch_uid="cost_key_enrolled_frozen", weak=False)
m2m_changed.connect(_guard_m2m(_trainer_keys), sender="planning.PlannedSession_trainers",
                    dispatch_uid="planned_session_trainers_frozen", weak=False)


class Absence(UUIDModel, TimeStampedModel):
    trainer = models.ForeignKey(Trainer, on_delete=models.CASCADE, related_name="absences")
    start_date = models.DateField()
    end_date = models.DateField()
    kind = models.CharField(max_length=16, choices=AbsenceKeyword.Kind.choices)
    label_raw = models.CharField(max_length=128, blank=True)
    origin = models.CharField(max_length=16, choices=Origin.choices, default=Origin.MANUAL)

    class Meta:
        ordering = ["start_date"]
        constraints = [
            models.CheckConstraint(check=Q(end_date__gte=F("start_date")), name="absence_dates_ok"),
            models.UniqueConstraint(
                fields=["trainer", "start_date", "end_date", "kind"], name="absence_unique"
            ),
        ]
        indexes = [models.Index(fields=["trainer", "start_date"])]

    def __str__(self) -> str:
        return f"{self.trainer} {self.kind} {self.start_date}→{self.end_date}"


class ReviewItem(UUIDModel, TimeStampedModel):
    """Ce que l'import de la grille n'a pas su trancher seul."""

    class Reason(models.TextChoices):
        COLOR_UNMAPPED = "COLOR_UNMAPPED", "Couleur sans règle"
        CODE_UNPARSEABLE = "CODE_UNPARSEABLE", "Texte de cellule non reconnu"
        NOT_IN_DATA = "NOT_IN_DATA", "Bloc absent de la feuille Data"
        DATA_MISMATCH = "DATA_MISMATCH", "Écart avec la feuille Data"
        OVERLAP = "OVERLAP", "Chevauchement"
        HOLIDAY_PROPOSAL = "HOLIDAY_PROPOSAL", "Jour férié à confirmer"

    class Status(models.TextChoices):
        OPEN = "OPEN", "À traiter"
        RESOLVED = "RESOLVED", "Traité"
        DISMISSED = "DISMISSED", "Écarté"

    import_log = models.ForeignKey(
        "core.ImportLog", on_delete=models.CASCADE, related_name="review_items"
    )
    sheet = models.CharField(max_length=64)
    cell_range = models.CharField(max_length=32)
    raw = models.JSONField(default=dict)
    proposed = models.JSONField(default=dict)
    reason = models.CharField(max_length=24, choices=Reason.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    resolution = models.JSONField(default=dict, blank=True)
    resolved_by = models.CharField(max_length=128, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    # Un réimport de la même grille ne duplique jamais un élément.
    fingerprint = models.CharField(max_length=64, unique=True)

    class Meta:
        ordering = ["status", "sheet", "created_at"]
        indexes = [models.Index(fields=["status", "reason"])]

    def __str__(self) -> str:
        return f"{self.sheet}!{self.cell_range} {self.reason}"
