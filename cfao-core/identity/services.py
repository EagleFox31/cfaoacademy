"""Services identity : règle Equipment + résolution du principal (scope côté service)."""
from django.core.exceptions import ValidationError

# Catégories de marques « lourdes » → toujours département Equipment (PLATFORM_ROLES.md).
PL_CATEGORIES = {"pl", "engins", "chariots", "bus"}


def check_equipment_rule(department_type, brand_categories):
    """Lève ValidationError si une marque PL/engins/chariots/bus est hors d'un dépt Equipment."""
    if department_type == "equipment":
        return
    offending = [c for c in brand_categories if c in PL_CATEGORIES]
    if offending:
        raise ValidationError(
            f"Marques {sorted(set(offending))} de catégorie lourde interdites hors d'un "
            f"département Equipment (département « {department_type} »)."
        )


def resolve_principal(user) -> dict:
    """Construit le principal Cerbos depuis les affectations ACTIVES (union).

    Le périmètre appartient à identity (pas au token) : on agrège rôles, scope nodes,
    départements et marques de toutes les affectations actives de l'utilisateur.
    """
    assignments = (
        user.assignments.filter(active=True)
        .select_related("scope_unit")
        .prefetch_related("brands", "departments")
    )
    roles, scope_nodes, brands, departments = set(), set(), set(), set()
    for a in assignments:
        roles.add(a.role)
        scope_nodes.add(a.scope_unit.code)
        brands.update(a.brands.values_list("code", flat=True))
        departments.update(a.departments.values_list("dtype", flat=True))

    return {
        "id": user.keycloak_sub,
        "roles": sorted(roles),
        "attr": {
            "scopeNodes": sorted(scope_nodes),
            "departments": sorted(departments),
            "brands": sorted(brands),
        },
    }
