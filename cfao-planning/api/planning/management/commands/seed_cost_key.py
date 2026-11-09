"""Paramètres annuels de la clé de répartition (SPEC §8). Idempotent.

Valeurs reprises de la synthèse « MOTORS GLOBAL » du classeur 2026. Les pays
enrôlés sont ceux de la synthèse (24) : un pays sans place y reste enrôlé, sa part
est simplement nulle. Une année déjà chargée est réalignée, jamais dupliquée.
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from referential.models import Country

from ...models import CostKeyYear

COST_KEYS = {
    (2026, "MOTORS"): {
        "budget": 300_000_000,
        "trainee_lodging_cost": 1_800_000,
        "trainer_lodging_cost": 1_800_000,
        "hours_per_session": 40,
        "enrolled": [
            "ben", "bfa", "cmr", "cog", "civ", "gab", "gmb", "gha", "gin", "gnq", "gnb",
            "ken", "mdg", "mli", "mar", "mrt", "ner", "nga", "caf", "cod", "sen", "tza",
            "tcd", "tgo",
        ],
    },
}


class Command(BaseCommand):
    help = "Charge les paramètres de la clé de répartition (budget, hébergement, pays enrôlés)."

    @transaction.atomic
    def handle(self, *args, **options):
        for (year, pole), params in COST_KEYS.items():
            params = dict(params)
            codes = params.pop("enrolled")
            countries = list(Country.objects.filter(code__in=codes))
            unknown = sorted(set(codes) - {c.code for c in countries})
            if unknown:
                raise CommandError(
                    f"Pays absents du référentiel : {', '.join(unknown)}. "
                    f"Lancer d'abord seed_referential."
                )
            # Creer seulement : une cle deja saisie ou revue n'est jamais ecrasee.
            key, created = CostKeyYear.objects.get_or_create(year=year, pole=pole, defaults=params)
            if created:
                key.enrolled_countries.set(countries)
            self.stdout.write(self.style.SUCCESS(
                f"Clé {year} {pole} : budget {key.budget}, {len(countries)} pays enrôlés."
            ))
