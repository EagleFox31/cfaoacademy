"""Relais de l'outbox des besoins vers cfao-planning (service compose `needs-relay`).

Réveillé par NOTIFY `needs_changed` ; sans notification, un passage toutes les
`NEEDS_RELAY_LISTEN_TIMEOUT_S` secondes reprend les relances dues. Un verrou
consultatif garantit une seule instance active, même avec plusieurs répliques.
"""
from __future__ import annotations

import logging
import time

import psycopg
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import close_old_connections, connection

from analytics.relay import deliver_pending

log = logging.getLogger(__name__)

CHANNEL = "needs_changed"
LOCK_KEY = 7_340_032  # pg_advisory_lock : un seul relais à la fois


def _conninfo() -> dict:
    db = connection.settings_dict
    return {k: v for k, v in {"dbname": db["NAME"], "user": db["USER"], "password": db["PASSWORD"],
                              "host": db["HOST"], "port": db["PORT"]}.items() if v}


class Command(BaseCommand):
    help = "Livre la copie des besoins à cfao-planning à chaque changement (NOTIFY + relance)."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Un seul passage, sans écouter.")

    def handle(self, *args, once=False, **options):
        if once:
            self.stdout.write(deliver_pending())
            return
        timeout = float(getattr(settings, "NEEDS_RELAY_LISTEN_TIMEOUT_S", 30))
        while True:
            try:
                self._listen(timeout)
            except psycopg.OperationalError as exc:
                log.warning("relais des besoins : base indisponible (%s), nouvel essai dans 5 s", exc)
                time.sleep(5)

    def _listen(self, timeout: float) -> None:
        with psycopg.connect(**_conninfo(), autocommit=True) as conn:
            while not conn.execute("SELECT pg_try_advisory_lock(%s)", (LOCK_KEY,)).fetchone()[0]:
                time.sleep(timeout)
            conn.execute(f"LISTEN {CHANNEL}")
            log.info("relais des besoins à l'écoute de %s", CHANNEL)
            while True:
                close_old_connections()
                try:
                    deliver_pending()
                except Exception:  # un échec de passage ne doit pas tuer le relais
                    log.exception("relais des besoins : passage en échec")
                for _ in conn.notifies(timeout=timeout, stop_after=1):
                    pass
