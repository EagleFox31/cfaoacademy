"""Agrégats d'une soumission et d'une campagne.

Le récapitulatif sert deux fois : à la filiale avant qu'elle ne soumette, et à
l'équipe Academy dans l'email interne. C'est le même calcul — un seul endroit.
"""
from __future__ import annotations

from django.db.models import Sum

from campaigns.models import QUARTERS, NeedLine, Place, Submission


def submission_summary(submission: Submission) -> dict:
    lines = (
        NeedLine.objects.filter(submission=submission)
        .select_related("catalog_line__family", "catalog_line__brand")
    )

    by_quarter = {q: 0 for q in QUARTERS}
    by_place = {Place.CFR: 0, Place.FILIALE: 0}
    families: dict[str, int] = {}
    selected = 0

    for line in lines:
        if line.is_empty:
            continue
        selected += 1
        family = line.catalog_line.family.label
        families[family] = families.get(family, 0) + line.total
        for quarter in QUARTERS:
            headcount = getattr(line, quarter)
            if not headcount:
                continue
            by_quarter[quarter] += headcount
            by_place[getattr(line, f"place_{quarter}")] += headcount

    return {
        "total_headcount": sum(by_quarter.values()),
        "by_quarter": by_quarter,
        "by_place": dict(by_place),
        "trainings_selected": selected,
        "families_touched": sorted(families),
        "by_family": families,
    }


def refresh_total(submission: Submission) -> int:
    """Recalcule le total dénormalisé porté par la soumission."""
    total = (
        NeedLine.objects.filter(submission=submission).aggregate(
            total=Sum("q1") + Sum("q2") + Sum("q3") + Sum("q4")
        )["total"]
        or 0
    )
    Submission.objects.filter(pk=submission.pk).update(total_headcount=total)
    submission.total_headcount = total
    return total


def campaign_summary(campaign) -> dict:
    """Vue de pilotage : où en est chaque filiale, et les totaux consolidés."""
    submissions = Submission.objects.filter(campaign=campaign).select_related("org_unit")
    by_status: dict[str, int] = {}
    for submission in submissions:
        by_status[submission.status] = by_status.get(submission.status, 0) + 1

    return {
        "campaign": campaign.year,
        "status": campaign.status,
        "submissions_total": submissions.count(),
        "by_status": by_status,
        "total_headcount": sum(s.total_headcount for s in submissions),
        "silent_org_units": [
            s.org_unit.label
            for s in submissions
            if s.status == Submission.Status.DRAFT and s.total_headcount == 0
        ],
    }
