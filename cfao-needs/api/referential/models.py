"""Référentiel — familles de catalogue, marques, organisation, profils.

Ce module porte ce qui est **stable d'une campagne à l'autre**. Ce qui change avec
la campagne (les lignes de catalogue, les besoins) vit dans `campaigns`.

En mode `standalone`, ces tables sont alimentées par import. En mode `integrated`,
elles sont synchronisées depuis `identity` et `lms` de la plateforme — sans que le
reste du code change (spec §2, §11).
"""
from django.db import models

from core.models import TimeStampedModel, UUIDModel


class Pole(models.TextChoices):
    MOBILITY = "MOBILITY", "Mobility"
    EQUIPMENT = "EQUIPMENT", "Equipment"
    CARROSSERIE = "CARROSSERIE", "Carrosserie"
    AUTRE = "AUTRE", "Autre"


class Brand(UUIDModel, TimeStampedModel):
    """Une marque réelle.

    Stellantis n'existe plus : CITROEN, FIAT, JEEP et PEUGEOT sont quatre marques
    distinctes, chacune avec son catalogue (spec §3.3).

    Une formation *transverse* n'a pas de marque — `CatalogLine.brand` vaut NULL.
    Les libellés « TOUTES MARQUES VL » / « TOUTES MARQUES EQUIPMENT » du fichier
    source sont convertis en NULL à l'import, jamais stockés comme des marques.
    """

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
    """Table d'alias — une **donnée**, pas du code (patron d'import, règle 6).

    Éditable par un administrateur, chaque alias daté et attribué. Exemples réels
    relevés dans les sources : `SINOTRUCK` → `SINOTRUK`, `OMODA & JAECOO` et
    `OMODA & JAECCO` → `OMODA & JAECOO` (orthographe de référence tranchée par le
    métier, story 16-25).
    """

    alias = models.CharField(max_length=96, unique=True)
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name="aliases")
    added_by = models.CharField(max_length=128, blank=True)

    class Meta:
        verbose_name_plural = "brand aliases"

    def __str__(self) -> str:
        return f"{self.alias} → {self.brand.code}"


class CatalogFamily(UUIDModel, TimeStampedModel):
    """Une famille de catalogue — l'axe principal du référentiel (spec §3.2).

    Le référentiel n'est PAS une liste de marques : c'est une liste de familles,
    dont certaines seulement se déclinent par marque. Et les familles Process se
    déclinent aussi par marque dans certains cas (`TP02` existe sur dix marques,
    `X24017V` est propre à MERCEDES) — d'où `has_brands` plutôt qu'une opposition
    « technique = par marque / process = transverse » qui serait fausse.
    """

    class Status(models.TextChoices):
        READY = "READY", "Catalogue disponible"
        PENDING = "PENDING", "Catalogue en préparation"
        HIDDEN = "HIDDEN", "Masquée"

    key = models.SlugField(max_length=64, unique=True)
    label = models.CharField(max_length=128)
    pole = models.CharField(max_length=16, choices=Pole.choices)
    has_brands = models.BooleanField(
        default=True,
        help_text="La famille peut porter des lignes rattachées à une marque.",
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "label"]
        verbose_name_plural = "catalog families"

    def __str__(self) -> str:
        return self.label

    @property
    def is_open(self) -> bool:
        """Une famille dont le catalogue n'est pas livré s'affiche mais ne se saisit pas."""
        return self.status == self.Status.READY


class OrgUnitRef(UUIDModel, TimeStampedModel):
    """Miroir local de l'organisation — filiales et agences.

    `org_path` reprend exactement le format de la plateforme (chaîne d'ancêtres),
    pour que la condition Cerbos `scopeNode ∈ orgPath` soit identique des deux côtés.
    """

    code = models.SlugField(max_length=64, unique=True)
    label = models.CharField(max_length=128)
    country = models.CharField(max_length=64, blank=True)
    locale = models.CharField(max_length=8, default="fr")
    org_path = models.JSONField(default=list)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["label"]

    def __str__(self) -> str:
        return self.label


class UserProfile(UUIDModel, TimeStampedModel):
    """Périmètre d'un compte, en mode `standalone`.

    **Aucune colonne mot de passe** — Keycloak est seul dépositaire des identifiants
    (interdit n° 1 de l'audit Academix, qui stockait le mot de passe en clair dans
    `visible_password` et le renvoyait par l'API).

    `locale` et `civility` sont portées par la personne, pas déduites de sa filiale :
    c'est le correctif de F19, qui avait coûté six PR correctives à Academix.
    """

    class Civility(models.TextChoices):
        NEUTRAL = "NEUTRE", "Neutre"
        M = "M", "Monsieur"
        MME = "MME", "Madame"

    keycloak_sub = models.CharField(max_length=64, unique=True)
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=128)
    roles = models.JSONField(default=list)
    org_unit = models.ForeignKey(
        OrgUnitRef, null=True, blank=True, on_delete=models.SET_NULL, related_name="members"
    )
    brands = models.ManyToManyField(Brand, blank=True, related_name="members")
    departments = models.JSONField(default=list)
    locale = models.CharField(max_length=8, default="fr")
    civility = models.CharField(
        max_length=8, choices=Civility.choices, default=Civility.NEUTRAL
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["display_name"]

    def __str__(self) -> str:
        return self.display_name

    def scope_nodes(self) -> list[str]:
        """MULTI-SCOPE : la liste des nœuds que ce compte couvre."""
        return list(self.org_unit.org_path) if self.org_unit else []
