"""Classification canonique des marques par Business Unit CFAO.

Une marque appartient à `Equipment` (poids lourds, engins, chariots, bus) OU à
`Motors` (véhicules légers, 2-roues) — cette classification est une **décision
métier**, pas une propriété observable des données MEDACAP.

Pourquoi maintenir un set côté code plutôt que de lire du Mongo :
- MEDACAP n'a pas de collection `brand` avec champ `pole` ; les tags sont
  distribués sur les techniciens (`users.brandJunior/Senior/Expert`), avec
  toutes les variantes d'écriture qu'on sait (SINOTRUCK, MUTSIBUSHI, …).
- Un tech classifié `department: "Equipment & Motors"` peut porter des marques
  des deux BU — impossible d'inférer la BU d'une marque depuis les techs.
- La règle métier « PL/engins/chariots/bus = Equipment » (voir PLATFORM_ROLES.md)
  est stable dans le temps ; l'énumérer explicitement rend le comportement lisible.

Miroir côté frontend : `SUPERADMIN_EQUIPMENT_BRANDS` / `SUPERADMIN_MOTORS_BRANDS`
dans `SuperAdminBuBrandsStrip.jsx`. Les deux listes doivent rester synchrones —
piste future : partager cette classification via un endpoint dédié pour
supprimer la duplication.

Les libellés sont **normalisés** (trim + upper + fix typos) via
`_normalize_brand` avant intersection — c'est la même normalisation appliquée
au comptage distinct.
"""
from __future__ import annotations

# Marques Equipment (poids lourds, engins, chariots, bus) — miroir front
# `SUPERADMIN_EQUIPMENT_BRANDS` (11 items).
EQUIPMENT_BRANDS: frozenset[str] = frozenset({
    "RENAULT TRUCK",
    "HINO",
    "FUSO",
    "SINOTRUK",
    "SHACMAN",
    "MERCEDES TRUCK",
    "KING LONG",
    "BT",              # Toyota Material Handling BT — enregistré aussi comme "TOYOTA BT" dans MEDACAP
    "TOYOTA FORKLIFT",
    "JCB",
    "LOVOL",
})

# Marques Motors (véhicules légers, 2-roues) — miroir front
# `SUPERADMIN_MOTORS_BRANDS` (9 items).
MOTORS_BRANDS: frozenset[str] = frozenset({
    "TOYOTA",
    "MERCEDES",
    "SUZUKI",
    "BYD",
    "MITSUBISHI",
    "OMODA",           # Omoda & Jaecoo
    "STELLANTIS",
    "CITROEN",
    "YAMAHA",
})


def bu_brands(bu: str) -> frozenset[str] | None:
    """Renvoie le set canonique de marques pour la BU demandée.

    `None` = pas de filtre (BU `all` ou inconnue → laisser toutes les marques).
    """
    if bu == "equipment":
        return EQUIPMENT_BRANDS
    if bu == "motors":
        return MOTORS_BRANDS
    return None
