"""Collecteur : boucle unique qui interroge Docker, la passerelle et Keycloak.

  python manage.py collect           boucle (processus du conteneur supervision-collector)
  python manage.py collect --once    une passe de chaque source (smoke, tests)
  python manage.py collect --check   sonde : 0 si Docker a été lu il y a moins de STALE_AFTER_S
Un seul collecteur travaille à la fois (verrou Postgres) ; un second attend.
"""
import logging
import sys
import time

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection
from django.utils import timezone

from supervision.collectors import activity, docker_collector
from supervision.models import CollectRun

log = logging.getLogger("supervision.collect")
LOCK_KEY = 0x5C0FA0  # verrou consultatif propre au collecteur
RETENTION_INTERVAL_S = 86400


def sources() -> dict:
    return {
        "docker": (settings.DOCKER_INTERVAL_S, docker_collector.collect),
        "edge": (settings.EDGE_INTERVAL_S, activity.collect_edge),
        "keycloak": (settings.KEYCLOAK_INTERVAL_S, activity.collect_keycloak),
        "retention": (RETENTION_INTERVAL_S, activity.purge),
    }


def run_source(name: str, func) -> bool:
    run, _ = CollectRun.objects.get_or_create(source=name)
    run.started_at = timezone.now()
    try:
        result = func()
    except Exception as exc:  # une source en panne ne bloque pas les autres
        run.ok = False
        run.error = f"{exc.__class__.__name__}: {exc}"[:500]
        log.warning("collecte %s en échec : %s", name, run.error)
    else:
        run.ok = True
        run.error = ""
        run.last_success_at = timezone.now()
        log.debug("collecte %s : %s", name, result)
    run.finished_at = timezone.now()
    run.save(update_fields=["started_at", "finished_at", "ok", "error", "last_success_at"])
    return run.ok


def _lock() -> bool:
    if connection.vendor != "postgresql":
        return True
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_lock(%s)", [LOCK_KEY])
        return bool(cursor.fetchone()[0])


class Command(BaseCommand):
    help = "Collecte l'état des modules (Docker, passerelle, Keycloak)."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")
        parser.add_argument("--check", action="store_true")

    def handle(self, *args, once=False, check=False, **options):
        if check:
            run = CollectRun.objects.filter(source="docker", last_success_at__isnull=False).first()
            fresh = run and (timezone.now() - run.last_success_at).total_seconds() < settings.STALE_AFTER_S
            sys.exit(0 if fresh else 1)
        if once:
            failures = [name for name, (_, func) in sources().items() if not run_source(name, func)]
            self.stdout.write(f"collecte : {'échec ' + ', '.join(failures) if failures else 'ok'}")
            sys.exit(1 if failures else 0)

        while not _lock():
            log.info("un autre collecteur travaille ; nouvel essai dans 30 s")
            time.sleep(30)
        log.info("collecteur démarré (projets : %s)", ", ".join(settings.SUPERVISION_PROJECTS) or "aucun")
        due = {name: 0.0 for name in sources()}
        while True:
            now = time.monotonic()
            for name, (interval, func) in sources().items():
                if now >= due[name]:
                    run_source(name, func)
                    due[name] = time.monotonic() + interval
            time.sleep(max(1.0, min(due.values()) - time.monotonic()))
