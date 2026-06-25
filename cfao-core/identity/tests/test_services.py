"""TDD B — résolution du principal (union des affectations) + règle Equipment pure."""
import pytest
from django.core.exceptions import ValidationError

from identity.models import Brand, Department, OrgUnit, RoleAssignment, User
from identity.services import check_equipment_rule, resolve_principal


def test_check_equipment_rule_pure():
    # PL hors equipment → erreur ; PL dans equipment → ok.
    with pytest.raises(ValidationError):
        check_equipment_rule("motors", ["vl", "pl"])
    check_equipment_rule("equipment", ["pl", "engins"])
    check_equipment_rule("motors", ["vl"])


@pytest.mark.django_db
def test_resolve_principal_union_des_affectations():
    grp = OrgUnit.objects.create(kind="group", slug="groupe", name="G")
    cmr = OrgUnit.objects.create(kind="branch", slug="cmr", name="CMR", parent=grp)
    civ = OrgUnit.objects.create(kind="branch", slug="civ", name="CIV", parent=grp)
    toyota = Brand.objects.create(code="toyota", name="Toyota", category="vl")
    fuso = Brand.objects.create(code="fuso", name="Fuso", category="pl")

    user = User.objects.create(keycloak_sub="sub-1", email="u@x.io", first_name="U", last_name="X")
    a1 = RoleAssignment.objects.create(user=user, role="ki", scope_unit=cmr)
    a1.brands.add(toyota)
    a2 = RoleAssignment.objects.create(user=user, role="workshop_manager", scope_unit=civ)
    a2.brands.add(fuso)

    p = resolve_principal(user)
    assert p["id"] == "sub-1"
    assert set(p["roles"]) == {"ki", "workshop_manager"}
    assert set(p["attr"]["scopeNodes"]) == {"groupe.cmr", "groupe.civ"}
    assert set(p["attr"]["brands"]) == {"toyota", "fuso"}


@pytest.mark.django_db
def test_resolve_principal_ignore_inactif():
    grp = OrgUnit.objects.create(kind="group", slug="groupe", name="G")
    cmr = OrgUnit.objects.create(kind="branch", slug="cmr", name="CMR", parent=grp)
    user = User.objects.create(keycloak_sub="sub-2", email="v@x.io", first_name="V", last_name="Y")
    RoleAssignment.objects.create(user=user, role="learner", scope_unit=cmr, active=False)

    p = resolve_principal(user)
    assert p["roles"] == []
    assert p["attr"]["scopeNodes"] == []
