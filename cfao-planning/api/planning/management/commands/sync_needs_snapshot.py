"""Rattrapage de la copie des besoins au démarrage (job `planning-migrate`).

GET conditionnel : sur une copie à jour, cfao-needs répond 304 et rien n'est
écrit. cfao-needs absent ne bloque jamais le démarrage (code de sortie 0) :
son relais poussera la copie dès qu'il sera là.
"""
from django.core.management.base import BaseCommand

from planning.clients.needs import OFFLINE_TIMEOUT_S, refresh_from_needs
from planning.services.needs_lines import ensure_needs_lines
from planning.services.year_summary import ensure_year_summaries


class Command(BaseCommand):
    help = "Récupère la copie des besoins de cfao-needs si elle a changé (toujours code 0)."

    def handle(self, *args, **options):
        try:
            outcome = refresh_from_needs(OFFLINE_TIMEOUT_S)
        except Exception as exc:  # démarrage jamais bloqué par un module voisin
            outcome = f"erreur ({type(exc).__name__})"
        self.stdout.write(f"copie des besoins : {outcome}")
        # Rattrapage (AGENTS.md §7) : base existante ou donnée écrite sans signal.
        # Sur une base à jour, zéro écriture.
        try:
            lines = ensure_needs_lines()
            summaries = ensure_year_summaries()
        except Exception as exc:
            self.stdout.write(f"lignes de besoins et résumés : erreur ({type(exc).__name__})")
            return
        self.stdout.write(f"lignes de besoins écrites : {lines} ; résumés annuels écrits : {summaries}")
