"""Rafraichit la copie des sessions du planning (contrat `cr-sessions`).

    python manage.py copier_planning

Seules les sessions dont la revision a change sont reecrites. La liste des
sessions le fait d'elle-meme a son ouverture (au plus une fois par
PLANNING_SYNC_INTERVALLE) ; la commande sert a l'exploitation et aux essais.
"""
from django.core.management.base import BaseCommand, CommandError

from comptes_rendus import planning


class Command(BaseCommand):
    help = "Copie les sessions a documenter depuis le planning."

    def handle(self, **options):
        if not planning.configure():
            raise CommandError("PLANNING_API_URL et CR_SESSIONS_KEY sont requis.")
        try:
            compte = planning.synchroniser()
        except planning.PlanningIndisponible as exc:
            raise CommandError(str(exc)) from None
        if compte is None:
            self.stdout.write("planning inchange : rien a copier")
            return
        self.stdout.write(", ".join(f"{v} {k.replace('_', ' ')}" for k, v in compte.items()))
