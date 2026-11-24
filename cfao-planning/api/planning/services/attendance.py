"""Synthèse annuelle des stagiaires (liste des participants), pour le portail.

Agrégats seulement : aucune ligne nominative ne sort de ce service.

- formations réalisées : formations distinctes terminées à la date du jour ;
- stagiaires formés : participations présentes à une formation terminée (une personne
  formée deux fois compte deux fois, comme dans le classeur) ;
- personnes formées : personnes distinctes parmi ces participations.
"""
from __future__ import annotations

import datetime as dt

from django.db.models import Count, Max, Q

from ..models import TraineeAttendance


def attendance_summary(year: int, today: dt.date | None = None) -> dict:
    today = today or dt.date.today()
    rows = TraineeAttendance.objects.filter(year=year)
    done = rows.filter(end_date__lte=today)
    present = done.filter(present=True)

    by_center = (
        done.values("center")
        .annotate(
            trainings_completed=Count("training_key", distinct=True),
            participations_present=Count("id", filter=Q(present=True)),
        )
        .order_by("center")
    )
    return {
        "year": year,
        "as_of": today,
        "loaded": rows.exists(),
        "updated_at": rows.aggregate(at=Max("updated_at"))["at"],
        "trainings_planned": rows.values("training_key").distinct().count(),
        "trainings_completed": done.values("training_key").distinct().count(),
        "participations": done.count(),
        "participations_present": present.count(),
        "presence_unknown": done.filter(present__isnull=True).count(),
        "people_trained": present.values("person_key").distinct().count(),
        "by_center": [
            {"center": c["center"] or "", "trainings_completed": c["trainings_completed"],
             "participations_present": c["participations_present"]}
            for c in by_center
        ],
    }
