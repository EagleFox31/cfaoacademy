"""Résolution des libellés `subsidiary` MEDACAP vers filiale UI.

MEDACAP stocke des noms bruts (`CFAO MOTORS COTE D'IVOIRE`, `CAMEROON MOTORS
INDUSTRIES`, `CFR`, …) sans code pays. Le portail super admin, lui, a besoin
d'un libellé propre (`Côte d'Ivoire`), d'un `countryCode` ISO-2 et d'un drapeau
côté frontend.

On maintient un mapping explicite plutôt qu'une heuristique regex :
- il y a ~14 subsidiaries distinctes, ça tient dans un dict lisible ;
- une regex sur `CAMEROON MOTORS INDUSTRIES` doit gérer un cas spécial de
  toute façon ;
- les évolutions (nouvelle filiale, renommage) sont explicites en review.

Miroir côté frontend : `SUPERADMIN_FILIALES_DATA` (18 entries) dans
`SuperAdminBuBrandsStrip.jsx`. Piste future : partager cette classification via
un endpoint dédié pour supprimer la duplication (voir BACKLOG SA-11).
"""
from __future__ import annotations

from typing import TypedDict


class SubsidiaryInfo(TypedDict, total=False):
    displayName: str
    countryCode: str  # ISO-2 minuscules
    isBranch: bool    # False = data invalide / non filiale (ex. '')


# clé = subsidiary raw normalisé (upper + trim).
# `displayName` = libellé UI, `countryCode` = ISO 3166-1 alpha-2 minuscule.
SUBSIDIARY_MAP: dict[str, SubsidiaryInfo] = {
    "CAMEROON MOTORS INDUSTRIES":   {"displayName": "Cameroun",            "countryCode": "cm", "isBranch": True},
    "CFAO MOTORS BENIN":            {"displayName": "Bénin",               "countryCode": "bj", "isBranch": True},
    "CFAO MOTORS BURKINA":          {"displayName": "Burkina Faso",        "countryCode": "bf", "isBranch": True},
    "CFAO MOTORS CENTRAFRIQUE":     {"displayName": "Centrafrique (RCA)",  "countryCode": "cf", "isBranch": True},
    "CFAO MOTORS CONGO":            {"displayName": "Congo",               "countryCode": "cg", "isBranch": True},
    "CFAO MOTORS COTE D'IVOIRE":    {"displayName": "Côte d'Ivoire",       "countryCode": "ci", "isBranch": True},
    "CFAO MOTORS GABON":            {"displayName": "Gabon",               "countryCode": "ga", "isBranch": True},
    "CFAO MOTORS MADAGASCAR":       {"displayName": "Madagascar",          "countryCode": "mg", "isBranch": True},
    "CFAO MOTORS MALI":             {"displayName": "Mali",                "countryCode": "ml", "isBranch": True},
    "CFAO MOTORS RDC":              {"displayName": "RDC",                 "countryCode": "cd", "isBranch": True},
    "CFAO MOTORS RWANDA":           {"displayName": "Rwanda",              "countryCode": "rw", "isBranch": True},
    "CFAO MOTORS SENEGAL":          {"displayName": "Sénégal",             "countryCode": "sn", "isBranch": True},
    # CFR = « Cameroon Full Repair » — atelier centralisé lié à CMI, on le
    # rattache au Cameroun pour ne pas fragmenter les KPIs pays.
    "CFR":                          {"displayName": "Cameroun",            "countryCode": "cm", "isBranch": True},
}


def resolve_subsidiary(raw: str | None) -> SubsidiaryInfo | None:
    """Renvoie la fiche filiale ou `None` si le raw n'est pas mappé.

    Un raw vide, `None`, ou non trouvé est considéré comme non-filiale (data
    invalide) — l'appelant ignore silencieusement.
    """
    if not raw or not isinstance(raw, str):
        return None
    key = raw.strip().upper()
    if not key:
        return None
    return SUBSIDIARY_MAP.get(key)
