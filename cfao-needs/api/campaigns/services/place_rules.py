"""Règle de lieu Cameroun : ≤6 → CFR seul ; ≥7 → CFR ou FILIALE au choix."""
from __future__ import annotations

import unicodedata

from campaigns.models import Place

# « Plus de 6 personnes » → seuil inclusif 7.
CMR_AGENCY_MIN = 7


def _normalize_country(country: str) -> str:
    raw = unicodedata.normalize("NFD", country or "")
    return "".join(c for c in raw if unicodedata.category(c) != "Mn").strip().lower()


def is_cameroon(country: str) -> bool:
    return _normalize_country(country) == "cameroun"


def resolve_place(country: str, headcount: int, requested: str | None = None) -> str:
    """Corrige le lieu demandé selon le pays et l'effectif du trimestre.

    Au Cameroun, un effectif ≤6 ne peut pas partir en agence. Au-delà, le
    déclarant choisit librement Academy Douala ou son agence.
    """
    place = requested if requested in Place.values else Place.CFR
    if not is_cameroon(country):
        return place
    if int(headcount or 0) < CMR_AGENCY_MIN:
        return Place.CFR
    return place
