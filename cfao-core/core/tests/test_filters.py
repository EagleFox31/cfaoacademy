"""TDD — traduction du query plan Cerbos → Django Q (core/authz/filters.py).

AST Cerbos (planResources, stable v1) :
  condition = { "expression": { "operator": <op>, "operands": [ ... ] } }
  feuilles  = { "variable": "request.resource.attr.<x>" } | { "value": <v> }
  and/or    = operands = [ {expression:{...}}, {expression:{...}} ]

Cas CLÉ visé : `request.principal.attr.scopeNode in request.resource.attr.orgPath`
→ au plan, le principal est connu : scopeNode devient une **valeur**, orgPath reste une
**variable liste** → test d'appartenance → `org_path CONTIENT scopeNode`.
"""
import pytest
from django.db.models import Q

from core.authz.filters import DeniedAll, plan_to_q

ATTR_MAP = {"orgPath": "org_path", "department": "department", "brand": "brand"}


def cond(expr):
    return {"kind": "KIND_CONDITIONAL", "condition": {"expression": expr}}


def test_always_allowed_donne_q_vide():
    assert plan_to_q({"kind": "KIND_ALWAYS_ALLOWED"}, ATTR_MAP) == Q()


def test_always_denied_leve_deniedall():
    with pytest.raises(DeniedAll):
        plan_to_q({"kind": "KIND_ALWAYS_DENIED"}, ATTR_MAP)


def test_scope_membership_scalaire_dans_liste():
    # scopeNode (valeur) ∈ orgPath (variable liste) → org_path__contains=[valeur]
    plan = cond({
        "operator": "in",
        "operands": [
            {"value": "groupe.cmr"},
            {"variable": "request.resource.attr.orgPath"},
        ],
    })
    assert plan_to_q(plan, ATTR_MAP) == Q(org_path__contains=["groupe.cmr"])


def test_in_variable_dans_liste_de_valeurs():
    # department (variable scalaire) ∈ ["motors","equipment"] → department__in=[...]
    plan = cond({
        "operator": "in",
        "operands": [
            {"variable": "request.resource.attr.department"},
            {"value": ["motors", "equipment"]},
        ],
    })
    assert plan_to_q(plan, ATTR_MAP) == Q(department__in=["motors", "equipment"])


def test_eq():
    plan = cond({
        "operator": "eq",
        "operands": [
            {"variable": "request.resource.attr.department"},
            {"value": "motors"},
        ],
    })
    assert plan_to_q(plan, ATTR_MAP) == Q(department="motors")


def test_and_combine_en_et():
    plan = cond({
        "operator": "and",
        "operands": [
            {"expression": {"operator": "eq", "operands": [
                {"variable": "request.resource.attr.department"}, {"value": "motors"}]}},
            {"expression": {"operator": "in", "operands": [
                {"value": "groupe.cmr"}, {"variable": "request.resource.attr.orgPath"}]}},
        ],
    })
    expected = Q(department="motors") & Q(org_path__contains=["groupe.cmr"])
    assert plan_to_q(plan, ATTR_MAP) == expected


def test_or_combine_en_ou():
    plan = cond({
        "operator": "or",
        "operands": [
            {"expression": {"operator": "eq", "operands": [
                {"variable": "request.resource.attr.brand"}, {"value": "toyota"}]}},
            {"expression": {"operator": "eq", "operands": [
                {"variable": "request.resource.attr.brand"}, {"value": "suzuki"}]}},
        ],
    })
    expected = Q(brand="toyota") | Q(brand="suzuki")
    assert plan_to_q(plan, ATTR_MAP) == expected


def test_exists_multi_scope():
    # AST réel Cerbos pour `scopeNodes.exists(s, s in orgPath)` (capturé live).
    plan = cond({
        "operator": "exists",
        "operands": [
            {"value": ["groupe.cmr", "groupe.civ"]},
            {"expression": {"operator": "lambda", "operands": [
                {"expression": {"operator": "in", "operands": [
                    {"variable": "s"}, {"variable": "request.resource.attr.orgPath"}]}},
                {"variable": "s"}]}},
        ],
    })
    expected = Q(org_path__contains=["groupe.cmr"]) | Q(org_path__contains=["groupe.civ"])
    assert plan_to_q(plan, ATTR_MAP) == expected


def test_exists_mono_scope():
    plan = cond({
        "operator": "exists",
        "operands": [
            {"value": ["groupe.cmr"]},
            {"expression": {"operator": "lambda", "operands": [
                {"expression": {"operator": "in", "operands": [
                    {"variable": "s"}, {"variable": "request.resource.attr.orgPath"}]}},
                {"variable": "s"}]}},
        ],
    })
    assert plan_to_q(plan, ATTR_MAP) == Q(org_path__contains=["groupe.cmr"])


def test_operateur_non_supporte_fail_closed():
    plan = cond({
        "operator": "startsWith",
        "operands": [
            {"variable": "request.resource.attr.department"}, {"value": "mot"}],
    })
    with pytest.raises(DeniedAll):
        plan_to_q(plan, ATTR_MAP)
