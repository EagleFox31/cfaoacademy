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

from django.db.models import Q

from referential.models import Country, Trainer
from referential.trainer_accounts import ACADEMY_SCOPE

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


def back_to_back(end: dt.date, start: dt.date) -> bool:
    """Vrai quand `start` suit `end` sans aucun jour ouvré entre les deux (week-end seul)."""
    day = dt.timedelta(days=1)
    return start > end and working_days(end + day, start - day) == 0


def _mark_close(sessions: list[dict]) -> int:
    """Marque les sessions rapprochées (avant ou après) et renvoie leur nombre.

    Des sessions enchaînées sans jour ouvré entre elles forment une seule formation
    (une formation de deux semaines, par exemple) : les deux semaines de pause se
    comptent après la fin de la dernière.
    """
    dated = [s for s in sessions if s["start_date"]]
    last = None  # session qui termine la formation en cours
    for nxt in dated:
        if last is not None and not back_to_back(last["end_date"], nxt["start_date"]) \
                and (nxt["start_date"] - last["end_date"]).days < MIN_GAP_DAYS:
            last["close"] = nxt["close"] = True
        if last is None or nxt["end_date"] >= last["end_date"]:
            last = nxt
    return sum(s["close"] for s in sessions)


def my_sessions(sub: str, today: dt.date | None = None) -> dict:
    """Sessions pas encore terminées du formateur relié au compte `sub`, par date.

    Toutes années confondues. Sans fiche reliée au compte : `linked=False` et
    liste vide (le lien se pose à la connexion, voir `trainer_accounts`).
    """
    today = today or dt.date.today()
    trainer = Trainer.objects.filter(keycloak_sub=sub).first() if sub else None
    if trainer is None:
        return {"linked": False, "sessions": []}
    planned = (trainer.planned_sessions
               .filter(Q(end_date__gte=today) | Q(end_date__isnull=True, start_date__gte=today))
               .select_related("brand", "country", "cost_key").order_by("start_date", "code_norm"))
    return {"linked": True, "sessions": [
        {**_session_json(s), "location": s.location, "delivery_mode": s.delivery_mode}
        for s in planned]}


def my_trainer(sub: str) -> dict:
    """Fiche du formateur relié au compte `sub` : pays où il est basé et marques.

    Sans pays sur la fiche, le formateur est à l'Academy. Sans fiche reliée :
    `linked=False` (le lien se pose à la connexion, voir `trainer_accounts`).
    """
    trainer = (Trainer.objects.filter(keycloak_sub=sub).select_related("home_country").first()
               if sub else None)
    if trainer is None:
        return {"linked": False, "trainer": None}
    country = trainer.home_country or Country.objects.filter(code__iexact=ACADEMY_SCOPE).first()
    return {"linked": True, "trainer": {
        "name": trainer.full_name,
        "country": {"code": country.code, "label": country.label} if country else None,
        "brands": [{"code": b.code, "label": b.label}
                   for b in trainer.brands.order_by("pole", "sort_order", "code")],
    }}


def trainer_load(year: int, today: dt.date | None = None) -> dict:
    today = today or dt.date.today()
    trainers = Trainer.objects.filter(
        is_active=True, is_external=False, kind=Trainer.Kind.TRAINER).select_related("home_country")
    # Les sessions « fiche » (places attribuées sur une fiche besoins, à dater) ne sont pas encore
    # des sessions à confier à un formateur : seules celles du classeur comptent ici.
    planned = (PlannedSession.objects.filter(cost_key__year=year, origin=PlannedSession.Origin.WORKBOOK)
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
