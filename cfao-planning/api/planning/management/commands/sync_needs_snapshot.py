"""Rattrapage de la copie des besoins au démarrage (job `planning-migrate`).

GET conditionnel : sur une copie à jour, cfao-needs répond 304 et rien n'est
écrit. cfao-needs absent ne bloque jamais le démarrage (code de sortie 0) :
son relais poussera la copie dès qu'il sera là.
"""
from django.core.management.base import BaseCommand

from planning.clients.needs import refresh_from_needs


class Command(BaseCommand):
    help = "Récupère la copie des besoins de cfao-needs si elle a changé (toujours code 0)."

    def handle(self, *args, **options):
        try:
            outcome = refresh_from_needs()
        except Exception as exc:  # démarrage jamais bloqué par un module voisin
            outcome = f"erreur ({type(exc).__name__})"
        self.stdout.write(f"copie des besoins : {outcome}")
