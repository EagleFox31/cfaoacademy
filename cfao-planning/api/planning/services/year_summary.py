"""Résumé d'une année (cartes Besoins et Devis du centre), écrit à l'écriture.

Aucun calcul à l'affichage : `GET /years/summary` lit `YearSummary` tel quel. La
ligne d'une année est recalculée quand une de ses données change, avec le calcul
du tableau global tous pôles (`consolidate([global_table(...)])`), en mode
prévisionnel comme le portail : les chiffres sont ceux du tableau, par
construction.

Déclenchement : les signaux de `planning.models` appellent `schedule(...)`. Le
recalcul part après le commit (`transaction.on_commit`), une fois par année
touchée même si la transaction a écrit cent cellules. `ensure_year_summaries`
rattrape au démarrage (base existante, écriture SQL directe, réglage changé) et
n'écrit rien si tout est à jour.
"""
from __future__ import annotations

import logging
import math
import threading

from django.db import connection, transaction
from django.utils import timezone

from ..models import CostKeyYear, PlannedSession, YearSummary
from .cost_key import Mode
from .cost_key_global import consolidate, global_table
from .needs_lines import resolved_needs, sync_needs_lines

log = logging.getLogger(__name__)

FIELDS = ("status", "answered", "known", "needs", "seats", "seats_offered", "fill_rate")
_LOCK_NAMESPACE = 0x5945  # verrou consultatif Postgres : (espace, année)


def synthese(g: dict, keys) -> dict:
    """Ce que les cartes affichent, tiré du tableau global tous pôles `g`.

    Une filiale qui a répondu pour Motors et pour Equipment ne compte qu'une fois.
    """
    codes = lambda field: len({c for r in g["responses"] for c in r[field]})
    offered = [k.seats_offered for k in keys if k.seats_offered is not None]
    seats_offered = sum(offered) if offered else None
    seats = g["total_seats"] or 0
    return {
        "status": g["status"],
        "answered": codes("answered"),
        "known": codes("known"),
        "needs": sum(t["needs"] or 0 for t in g["brand_totals"].values()),
        "seats": seats,
        "seats_offered": seats_offered,
        # Arrondi à l'entier le plus proche, demi vers le haut.
        "fill_rate": math.floor(seats * 100 / seats_offered + 0.5) if seats_offered else None,
    }


def compute_summary(year: int) -> dict | None:
    """Chiffres de l'année, None si elle n'a aucune clé de répartition."""
    keys = list(CostKeyYear.objects.filter(year=year).order_by("pole"))
    if not keys:
        return None
    tables = [global_table(k, Mode.PLANNED, resolved_needs(k.year, k.pole)) for k in keys]
    return synthese(consolidate(tables), keys)


def refresh_year_summary(year: int) -> bool:
    """Recalcule la ligne de l'année ; True si elle a été écrite (ou supprimée)."""
    with transaction.atomic():
        if connection.vendor == "postgresql":  # deux recalculs de la même année : l'un après l'autre
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_xact_lock(%s, %s)", [_LOCK_NAMESPACE, year])
        values = compute_summary(year)
        row = YearSummary.objects.filter(year=year).first()
        if values is None:
            if row is None:
                return False
            row.delete()
            return True
        if row is not None and all(getattr(row, f) == values[f] for f in FIELDS):
            return False
        YearSummary.objects.update_or_create(year=year, defaults={**values, "computed_at": timezone.now()})
        return True


def _all_years() -> set[int]:
    return set(CostKeyYear.objects.values_list("year", flat=True)) | set(
        YearSummary.objects.values_list("year", flat=True))


def ensure_year_summaries() -> int:
    """Rattrapage : chaque année recalculée, nombre de lignes écrites (0 si à jour)."""
    return sum(refresh_year_summary(y) for y in sorted(_all_years()))


# ── Recalcul après le commit, dédoublonné ───────────────────────────────────
_pending = threading.local()


def _state():
    if not hasattr(_pending, "years"):
        _pending.years, _pending.keys, _pending.sessions = set(), set(), set()
        _pending.all, _pending.lines = False, False
    return _pending


def schedule(years=(), keys=(), sessions=(), all_years: bool = False, needs_lines: bool = False) -> None:
    """Demande le recalcul des années touchées, au commit de la transaction en cours."""
    s = _state()
    s.years.update(years)
    s.keys.update(keys)
    s.sessions.update(sessions)
    s.all = s.all or all_years
    s.lines = s.lines or needs_lines
    transaction.on_commit(_flush)


def _flush() -> None:
    s = _state()
    if not (s.years or s.keys or s.sessions or s.all or s.lines):
        return  # déjà traité par un rappel précédent du même commit
    years, keys, sessions = set(s.years), set(s.keys), set(s.sessions)
    every, lines = s.all, s.lines
    s.years, s.keys, s.sessions = set(), set(), set()
    s.all, s.lines = False, False
    try:
        if lines:
            sync_needs_lines()
        if every:
            years = _all_years()
        else:
            if sessions:
                keys |= set(PlannedSession.objects.filter(pk__in=sessions).values_list("cost_key_id", flat=True))
            if keys:
                years |= set(CostKeyYear.objects.filter(pk__in=keys).values_list("year", flat=True))
    except Exception:  # un résumé en retard ne doit jamais faire échouer l'écriture validée
        log.exception("résumé annuel : préparation du recalcul en échec")
        return
    for year in sorted(years):
        try:
            refresh_year_summary(year)
        except Exception:
            log.exception("résumé annuel %s : recalcul en échec", year)
