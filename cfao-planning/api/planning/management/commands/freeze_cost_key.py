"""Gèle la clé de répartition d'une année et d'un pôle. Idempotent."""
from django.core.management.base import BaseCommand, CommandError

from ...models import CostKeyYear
from ...services.cost_key_freeze import FreezeRefused, freeze


class Command(BaseCommand):
    help = "Gèle le prévisionnel d'une clé de répartition et en prend le snapshot."

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int, required=True)
        parser.add_argument("--pole", required=True)
        parser.add_argument("--actor", default="manage.py")

    def handle(self, *args, year, pole, actor, **options):
        key = CostKeyYear.objects.filter(year=year, pole=pole).first()
        if key is None:
            raise CommandError(f"Aucune clé {year} {pole}. Lancer d'abord seed_cost_key.")
        try:
            snapshot = freeze(key, actor)
        except FreezeRefused as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(self.style.SUCCESS(
            f"{key} gelée, snapshot {snapshot.inputs_sha256[:12]}."
        ))
