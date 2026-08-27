"""Attend que le schéma soit en place avant de démarrer un service qui en dépend.

Le worker consomme une file stockée en base (`django_q_ormq`). Comme les migrations
sont **explicites** et ne tournent pas dans l'entrypoint (interdit n° 10), il existe
une fenêtre entre `make up` et `make migrate` pendant laquelle la table n'existe pas.

Sans cette attente, le worker boucle en erreur : `relation "django_q_ormq" does not
exist`, mort et réincarnation toutes les quelques secondes. Il finit par se remettre,
mais les journaux sont illisibles et le processus consomme pour rien — et surtout,
un exploitant qui lit `CRITICAL reincarnated pusher after sudden death` au démarrage
croit légitimement que la stack est cassée.
"""
import time

from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = "Bloque jusqu'à ce que les tables attendues existent (ou expire)."

    def add_arguments(self, parser):
        parser.add_argument("tables", nargs="*", default=["django_q_ormq"])
        parser.add_argument("--timeout", type=int, default=300)
        parser.add_argument("--interval", type=int, default=3)

    def handle(self, *args, **options):
        wanted = set(options["tables"] or ["django_q_ormq"])
        deadline = time.monotonic() + options["timeout"]
        announced = False

        while True:
            existing = set(connection.introspection.table_names())
            missing = sorted(wanted - existing)
            if not missing:
                self.stdout.write(self.style.SUCCESS(
                    "Schéma disponible : " + ", ".join(sorted(wanted))
                ))
                return

            if time.monotonic() > deadline:
                raise CommandError(
                    "Tables toujours absentes après "
                    f"{options['timeout']} s : {', '.join(missing)}. "
                    "Les migrations ont-elles été appliquées (make migrate) ?"
                )

            if not announced:
                self.stdout.write(
                    f"En attente du schéma ({', '.join(missing)}) — "
                    f"lancez « make migrate » si ce n'est pas déjà fait."
                )
                announced = True
            time.sleep(options["interval"])
