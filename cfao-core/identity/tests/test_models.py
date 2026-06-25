"""TDD B — modèle org : dénormalisation org_path + règle Equipment."""
import pytest
from django.core.exceptions import ValidationError

from identity.models import Brand, Department, OrgUnit


@pytest.mark.django_db
def test_orgunit_code_et_path_denormalises():
    grp = OrgUnit.objects.create(kind="group", slug="groupe", name="Groupe")
    reg = OrgUnit.objects.create(kind="region", slug="afrique_ouest", name="Afrique Ouest", parent=grp)
    br = OrgUnit.objects.create(kind="branch", slug="cote_divoire", name="CIV", parent=reg)
    ag = OrgUnit.objects.create(kind="agency", slug="abidjan_plateau", name="Abidjan Plateau", parent=br)

    assert grp.code == "groupe"
    assert grp.path == ["groupe"]
    assert ag.code == "groupe.afrique_ouest.cote_divoire.abidjan_plateau"
    assert ag.path == [
        "groupe",
        "groupe.afrique_ouest",
        "groupe.afrique_ouest.cote_divoire",
        "groupe.afrique_ouest.cote_divoire.abidjan_plateau",
    ]
    # scopeNode = code de l'unité (== path[-1])
    assert ag.scope_node == ag.code == ag.path[-1]


@pytest.mark.django_db
def test_regle_equipment_refuse_marque_pl_hors_equipment():
    grp = OrgUnit.objects.create(kind="group", slug="groupe", name="G")
    br = OrgUnit.objects.create(kind="branch", slug="cmr", name="CMR", parent=grp)
    fuso = Brand.objects.create(code="fuso", name="Fuso", category="pl")
    dept = Department(branch=br, dtype="motors")
    dept.save()
    dept.brands.add(fuso)
    with pytest.raises(ValidationError):
        dept.clean()  # PL dans un département non-Equipment → interdit


@pytest.mark.django_db
def test_regle_equipment_accepte_pl_dans_equipment():
    grp = OrgUnit.objects.create(kind="group", slug="groupe", name="G")
    br = OrgUnit.objects.create(kind="branch", slug="cmr", name="CMR", parent=grp)
    jcb = Brand.objects.create(code="jcb", name="JCB", category="engins")
    dept = Department(branch=br, dtype="equipment")
    dept.save()
    dept.brands.add(jcb)
    dept.clean()  # ne lève pas


@pytest.mark.django_db
def test_regle_equipment_accepte_vl_dans_motors():
    grp = OrgUnit.objects.create(kind="group", slug="groupe", name="G")
    br = OrgUnit.objects.create(kind="branch", slug="cmr", name="CMR", parent=grp)
    toyota = Brand.objects.create(code="toyota", name="Toyota", category="vl")
    dept = Department(branch=br, dtype="motors")
    dept.save()
    dept.brands.add(toyota)
    dept.clean()  # VL dans Motors → OK
