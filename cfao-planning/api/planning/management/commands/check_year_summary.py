"""Contrôle en lecture seule : le résumé stocké est-il celui que le calcul donne ?

Code de sortie 1 au moindre écart. Rien n'est écrit.
"""
from django.core.management.base import BaseCommand, CommandError

from planning.models import YearSummary
from planning.services.year_summary import FIELDS, _all_years, compute_summary


class Command(BaseCommand):
    help = "Compare le résumé annuel stocké au calcul du tableau global (lecture seule)."

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int)

    def handle(self, *args, year=None, **options):
        gaps = 0
        for y in [year] if year else sorted(_all_years()):
            computed = compute_summary(y)
            row = YearSummary.objects.filter(year=y).first()
            stored = {f: getattr(row, f) for f in FIELDS} if row else None
            same = computed == stored
            gaps += not same
            self.stdout.write(f"{y} : {'OK' if same else 'ÉCART'} stocké={stored} calculé={computed}")
        if gaps:
            raise CommandError(f"{gaps} année(s) en écart")
