"""Amorçage et réglage d'une clé annuelle (SPEC §8, cas « amorcer la clé »).

Amorcer = créer la clé d'une année à partir de la précédente du même pôle
(budget, coûts d'hébergement, heures, pays enrôlés), chaque valeur restant
surchargeable. Créer seulement : une clé existante n'est jamais écrasée.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.db import transaction

from referential.models import Country

from ..models import CostKeyYear, FrozenKeyError

PARAMS = ("budget", "trainee_lodging_cost", "trainer_lodging_cost", "hours_per_session")


class SetupError(ValueError):
    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.code, self.details = code, details or {}


def _clean(data: dict) -> dict:
    cleaned = {}
    for name in PARAMS:
        if name not in data or data[name] in (None, ""):
            continue
        try:
            value = Decimal(str(data[name]))
        except InvalidOperation:
            raise SetupError("INVALID_NUMBER", f"{name} n'est pas un nombre.", {"field": name})
        if value < 0 or value != value.to_integral_value():
            raise SetupError("INVALID_NUMBER", f"{name} doit être un entier positif.",
                             {"field": name})
        cleaned[name] = int(value) if name == "hours_per_session" else value
    if cleaned.get("hours_per_session") == 0:
        raise SetupError("INVALID_NUMBER", "hours_per_session doit être > 0.",
                         {"field": "hours_per_session"})
    return cleaned


def _countries(codes) -> list[Country]:
    codes = list(dict.fromkeys(codes))
    countries = list(Country.objects.filter(code__in=codes))
    unknown = sorted(set(codes) - {c.code for c in countries})
    if unknown:
        raise SetupError("UNKNOWN_COUNTRY", "Pays absents du référentiel.", {"codes": unknown})
    return countries


@transaction.atomic
def bootstrap(year: int, pole: str, data: dict | None = None) -> tuple[CostKeyYear, bool]:
    """(clé, créée). Une clé déjà là est renvoyée telle quelle."""
    data = data or {}
    existing = CostKeyYear.objects.filter(year=year, pole=pole).first()
    if existing:
        return existing, False
    previous = CostKeyYear.objects.filter(pole=pole, year__lt=year).order_by("-year").first()
    params = {name: getattr(previous, name) for name in PARAMS} if previous else {}
    params.update(_clean(data))
    if "budget" not in params:
        raise SetupError("BUDGET_REQUIRED", "Aucune clé précédente : le budget est obligatoire.")
    key = CostKeyYear.objects.create(year=year, pole=pole, **params)
    if "enrolled" in data:
        countries = _countries(data["enrolled"])
    else:
        countries = list(previous.enrolled_countries.all()) if previous else []
    key.enrolled_countries.set(countries)
    return key, True


@transaction.atomic
def update(key: CostKeyYear, data: dict) -> CostKeyYear:
    if key.is_frozen:
        raise FrozenKeyError(f"{key} est gelée : paramètres non modifiables.")
    for name, value in _clean(data).items():
        setattr(key, name, value)
    key.save()
    if "enrolled" in data:
        key.enrolled_countries.set(_countries(data["enrolled"]))
    return key
