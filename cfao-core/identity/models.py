"""Modèle org & comptes (apps 11 + 12). Source de vérité du périmètre."""
from django.db import models

from core.models import TimeStampedModel, UUIDModel
from .services import check_equipment_rule

ORG_KINDS = [
    ("group", "Groupe"),
    ("region", "Région"),
    ("branch", "Filiale"),
    ("agency", "Agence"),
]


class OrgUnit(UUIDModel, TimeStampedModel):
    """Nœud de l'arbre org. `code` = chemin pointé (= scopeNode) ; `path` = ancêtres cumulés."""

    kind = models.CharField(max_length=16, choices=ORG_KINDS)
    slug = models.SlugField(max_length=64)
    name = models.CharField(max_length=255)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="children")
    code = models.CharField(max_length=512, unique=True, editable=False)
    path = models.JSONField(default=list, editable=False)

    def save(self, *args, **kwargs):
        if self.parent:
            self.code = f"{self.parent.code}.{self.slug}"
            self.path = list(self.parent.path) + [self.code]
        else:
            self.code = self.slug
            self.path = [self.code]
        super().save(*args, **kwargs)

    @property
    def scope_node(self) -> str:
        return self.code

    def __str__(self):
        return self.code


class Brand(UUIDModel, TimeStampedModel):
    code = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    # vl = véhicule léger ; pl/engins/chariots/bus = lourd (→ département Equipment)
    category = models.CharField(max_length=32)

    def __str__(self):
        return self.code


class Department(UUIDModel, TimeStampedModel):
    branch = models.ForeignKey(OrgUnit, on_delete=models.CASCADE, related_name="departments")
    dtype = models.CharField(max_length=64)  # motors / equipment / toyota / suzuki / multi…
    brands = models.ManyToManyField(Brand, blank=True, related_name="departments")

    def clean(self):
        # Règle absolue : PL/engins/chariots/bus = département Equipment, sans exception.
        check_equipment_rule(self.dtype, self.brands.values_list("category", flat=True))

    def __str__(self):
        return f"{self.branch.code}:{self.dtype}"


class User(UUIDModel, TimeStampedModel):
    keycloak_sub = models.CharField(max_length=64, unique=True)
    email = models.EmailField()
    first_name = models.CharField(max_length=128, blank=True)
    last_name = models.CharField(max_length=128, blank=True)
    # Périmètre dénormalisé : union des `path` des unités de ses affectations actives.
    # Permet le filtrage de liste scopé (`scope_paths CONTIENT scopeNode`) sans jointure.
    scope_paths = models.JSONField(default=list, editable=False)

    def recompute_scope_paths(self):
        paths = set()
        for a in self.assignments.filter(active=True).select_related("scope_unit"):
            paths.update(a.scope_unit.path)
        self.scope_paths = sorted(paths)
        self.save(update_fields=["scope_paths"])

    def __str__(self):
        return self.email or self.keycloak_sub


class RoleAssignment(UUIDModel, TimeStampedModel):
    """Affectation cumulable : rôle + périmètre org + départements + marques."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="assignments")
    role = models.CharField(max_length=64)
    scope_unit = models.ForeignKey(OrgUnit, on_delete=models.PROTECT, related_name="assignments")
    departments = models.ManyToManyField(Department, blank=True, related_name="assignments")
    brands = models.ManyToManyField(Brand, blank=True, related_name="assignments")
    active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user} · {self.role} @ {self.scope_unit.code}"
