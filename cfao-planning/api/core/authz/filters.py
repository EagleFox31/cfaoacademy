"""Traduction du query plan Cerbos → Django Q (architecture.md §5.3, note).

Cerbos ne fournit PAS d'adaptateur Django ORM (seulement SQLAlchemy/Prisma/Drizzle).
Ce module parse l'AST du plan vers des objets Q. Squelette volontairement partiel :
gère ALWAYS_ALLOWED/DENIED et les opérateurs simples (eq, in, and, or).
L'opérateur « scalaire ∈ attribut-liste » (scopeNode in orgPath) est une story
dédiée à chiffrer (ARCHITECTURE-complements.md §1).
"""
from __future__ import annotations

from django.db.models import Q

ALWAYS_ALLOWED = "KIND_ALWAYS_ALLOWED"
ALWAYS_DENIED = "KIND_ALWAYS_DENIED"
CONDITIONAL = "KIND_CONDITIONAL"


class DeniedAll(Exception):
    """Signale qu'aucune ligne ne doit être renvoyée."""


def plan_to_q(plan: dict, attr_map: dict[str, str]) -> Q:
    """attr_map : nom d'attribut ressource Cerbos → champ ORM (ex. {"orgPath": "org_path"})."""
    kind = plan.get("kind")
    if kind == ALWAYS_ALLOWED:
        return Q()
    if kind == ALWAYS_DENIED:
        raise DeniedAll()
    if kind == CONDITIONAL:
        return _expr_to_q(plan.get("condition", {}), attr_map)
    raise DeniedAll()


def _expr_to_q(node: dict, attr_map: dict[str, str]) -> Q:
    expr = node.get("expression") or node
    op = expr.get("operator")
    operands = expr.get("operands", [])

    if op in ("and", "or"):
        qs = [_expr_to_q(o, attr_map) for o in operands]
        out = qs[0]
        for q in qs[1:]:
            out = (out & q) if op == "and" else (out | q)
        return out

    if op == "exists":
        # MULTI-SCOPE : `scopeNodes.exists(s, s in R.orgPath)`.
        # AST = [ {value:[...]}, {expression: lambda(body, var s)} ].
        # → OR sur chaque valeur : R.field CONTIENT valeur.
        return _exists_to_q(operands, attr_map)

    if op == "eq":
        field = _field(operands, attr_map)
        return Q(**{field: _value(operands)})

    if op == "in":
        # Deux sens possibles pour `a in b` :
        #  - variable (scalaire) ∈ liste-de-valeurs  → field IN [...]
        #    ex. R.attr.department in ["motors","equipment"]
        #  - valeur (scalaire) ∈ variable-liste       → field CONTIENT valeur
        #    ex. P.attr.scopeNode in R.attr.orgPath  (le cœur du filtrage de périmètre)
        field = _field(operands, attr_map)
        value = _value(operands)
        if isinstance(value, list):
            return Q(**{f"{field}__in": value})
        # Appartenance à un attribut liste (org_path) : `__contains=[valeur]`.
        # Postgres : ArrayField/JSONField `@>` → SQL `:scope = ANY(org_path)` (cf. architecture.md §5.3).
        return Q(**{f"{field}__contains": [value]})

    # Opérateur non encore géré → fail-closed.
    raise DeniedAll()


def _exists_to_q(operands: list, attr_map: dict[str, str]) -> Q:
    """`exists(values, lambda s: s in R.field)` → OR de `field__contains=[v]` sur les valeurs."""
    collection = next((o for o in operands if "value" in o or "variable" in o), None)
    lam = next((o["expression"] for o in operands
                if "expression" in o and o["expression"].get("operator") == "lambda"), None)
    if collection is None or lam is None:
        raise DeniedAll()

    values = collection.get("value")
    if not isinstance(values, list) or not values:  # collection non constante ou vide
        raise DeniedAll()

    lam_ops = lam.get("operands", [])
    body = next((o["expression"] for o in lam_ops if "expression" in o), None)
    lam_var = next((o["variable"] for o in lam_ops if "variable" in o), None)
    if body is None or lam_var is None or body.get("operator") != "in":
        raise DeniedAll()

    # Le champ = la variable du corps qui n'est PAS la variable du lambda.
    field = None
    for o in body.get("operands", []):
        var = o.get("variable")
        if var and var != lam_var:
            name = var.split(".")[-1]
            field = attr_map.get(name, name)
    if not field:
        raise DeniedAll()

    out = None
    for v in values:
        clause = Q(**{f"{field}__contains": [v]})
        out = clause if out is None else (out | clause)
    return out


def _field(operands: list, attr_map: dict[str, str]) -> str:
    for o in operands:
        var = o.get("variable")
        if var:
            name = var.split(".")[-1]
            return attr_map.get(name, name)
    raise DeniedAll()


def _value(operands: list):
    for o in operands:
        if "value" in o:
            return o["value"]
    raise DeniedAll()
