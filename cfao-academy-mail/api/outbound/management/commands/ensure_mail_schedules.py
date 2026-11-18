"""Tâches planifiées du hub, lancées par le job `mail-migrate` (AGENTS.md §7).

Créer-seulement : une planification déjà présente n'est jamais modifiée (un
réglage revu en prod est conservé). Sur une base à jour, zéro écriture.
"""
from django.core.management.base import BaseCommand
from django_q.models import Schedule

SCHEDULES = (
    {
        "name": "mail.purge_sensitive_messages",
        "func": "outbound.tasks.purge_sensitive_messages",
        "schedule_type": Schedule.MINUTES,
        "minutes": 5,
        "repeats": -1,
    },
)


class Command(BaseCommand):
    help = "Crée les planifications manquantes du hub mail (purge des messages sensibles)."

    def handle(self, *args, **options):
        created = 0
        for spec in SCHEDULES:
            if Schedule.objects.filter(name=spec["name"]).exists():
                continue
            Schedule.objects.create(**spec)
            created += 1
        self.stdout.write(self.style.SUCCESS(f"Planifications créées : {created}"))
