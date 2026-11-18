"""Charge des formateurs d'une année, pour le directeur du centre.

Source : le prévisionnel de l'année (`PlannedSession` des clés de l'année, tous
pôles). Un formateur, au sens de la clé, est un animateur Academy interne
(`Trainer.Kind.TRAINER`, non externe) : les techniciens instructeurs et les
intervenants externes ne sont pas suivis ici.

Règle de rythme (décision métier) : idéalement deux semaines entre deux
formations d'un même formateur. Deux sessions sont « rapprochées » quand moins de
`MIN_GAP_DAYS` jours séparent la fin de l'une du début de la suivante. Il n'y a
pas de plafond de jours par an.
"""
from __future__ import annotations

import datetime as dt

from referential.models import Trainer

from ..models import PlannedSession

MIN_GAP_DAYS = 14


def working_days(start: dt.date | None, end: dt.date | None) -> int:
    """Jours ouvrés (lundi à vendredi) d'une session ; une date seule compte pour un jour."""
    if start is None:
        return 0
    end = end or start
    full_weeks, rest = divmod((end - start).days + 1, 7)
    days = full_weeks * 5
    for offset in range(rest):
        if (start + dt.timedelta(days=full_weeks * 7 + offset)).weekday() < 5:
            days += 1
    return days


def _session_json(s: PlannedSession) -> dict:
    return {
        "id": str(s.pk),
        "code": s.code_raw or s.code_norm,
        "title": s.title,
        "brand": s.brand.label,
        "brand_code": s.brand.code,
        "pole": s.cost_key.pole,
        "start_date": s.start_date,
        "end_date": s.end_date or s.start_date,
        "country": s.country.code,
        "country_label": s.country.label,
        "days": working_days(s.start_date, s.end_date),
        "close": False,
    }


def _mark_close(sessions: list[dict]) -> int:
    """Marque les sessions rapprochées (avant ou après) et renvoie leur nombre."""
    dated = [s for s in sessions if s["start_date"]]
    for prev, nxt in zip(dated, dated[1:]):
        if (nxt["start_date"] - prev["end_date"]).days < MIN_GAP_DAYS:
            prev["close"] = nxt["close"] = True
    return sum(s["close"] for s in sessions)


def trainer_load(year: int, today: dt.date | None = None) -> dict:
    today = today or dt.date.today()
    trainers = Trainer.objects.filter(
        is_active=True, is_external=False, kind=Trainer.Kind.TRAINER).select_related("home_country")
    planned = (PlannedSession.objects.filter(cost_key__year=year)
               .select_related("brand", "country", "cost_key").prefetch_related("trainers"))

    by_trainer: dict = {t.pk: [] for t in trainers}
    unassigned = 0
    for s in planned:
        linked = [t.pk for t in s.trainers.all() if t.pk in by_trainer]
        if not s.trainers.all():
            unassigned += 1
        for pk in linked:
            by_trainer[pk].append(_session_json(s))

    rows = []
    for t in trainers:
        sessions = sorted(by_trainer[t.pk], key=lambda s: (s["start_date"] is None, s["start_date"] or dt.date.max))
        upcoming = next((s for s in sessions if s["start_date"] and s["start_date"] >= today), None)
        rows.append({
            "id": str(t.pk),
            "name": t.full_name,
            "service": t.service,
            "service_label": t.get_service_display(),
            "days": sum(s["days"] for s in sessions),
            "sessions_count": len(sessions),
            "close_sessions": _mark_close(sessions),
            "next_session": upcoming and {"start_date": upcoming["start_date"],
                                          "country": upcoming["country"],
                                          "country_label": upcoming["country_label"]},
            "sessions": sessions,
        })
    rows.sort(key=lambda r: (-r["days"], -r["sessions_count"], r["name"]))
    return {
        "year": year,
        "min_gap_days": MIN_GAP_DAYS,
        "sessions": len(planned),
        "unassigned_sessions": unassigned,
        "trainers": rows,
    }
