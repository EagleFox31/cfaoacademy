"""Transitions d'état d'une soumission — et ce qu'elles déclenchent.

Le point important est ce qu'elles **ne** déclenchent pas : `submit()` n'envoie
rien à la filiale. Il notifie l'équipe Academy, qui relit, puis valide — et c'est
`validate()` qui prépare la confirmation (spec §7.0).
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from campaigns.models import Submission, SubmissionEvent

from .summary import refresh_total, submission_summary


class TransitionRefused(Exception):
    """L'état courant n'autorise pas cette transition."""


def _event(submission, kind, actor="", on_behalf_of="", **payload):
    return SubmissionEvent.objects.create(
        submission=submission,
        kind=kind,
        actor=actor,
        on_behalf_of=on_behalf_of,
        payload=payload,
    )


@transaction.atomic
def submit(submission: Submission, actor_profile, on_behalf_of: str = "") -> Submission:
    """La filiale soumet. **Aucun email ne part vers elle à cette étape.**"""
    if not submission.is_editable:
        raise TransitionRefused(
            f"Cette fiche est en statut « {submission.get_status_display()} » : "
            f"elle ne peut plus être soumise."
        )

    now = timezone.now()
    if not submission.campaign.accepts_entries(now):
        raise TransitionRefused(
            "La campagne est fermée. Contactez l'équipe Academy pour une réouverture."
        )

    refresh_total(submission)
    submission.status = Submission.Status.SUBMITTED
    submission.submitted_by = actor_profile
    submission.submitted_at = now
    submission.last_activity_at = now
    # Une fiche soumise sort de la boucle de relance.
    submission.reminder_state = Submission.ReminderState.NONE
    submission.save(
        update_fields=[
            "status", "submitted_by", "submitted_at",
            "last_activity_at", "reminder_state", "updated_at",
        ]
    )

    _event(
        submission,
        SubmissionEvent.Kind.SUBMITTED,
        actor=getattr(actor_profile, "email", ""),
        on_behalf_of=on_behalf_of,
        summary=submission_summary(submission),
    )

    # Envoi INTERNE uniquement — regroupé après N minutes d'inactivité.
    from outbound.services.queue import schedule_internal_summary

    schedule_internal_summary(submission)
    return submission


@transaction.atomic
def validate(submission: Submission, reviewer_profile) -> Submission:
    """L'équipe Academy valide. C'est **ici** que la confirmation est préparée."""
    if submission.status != Submission.Status.SUBMITTED:
        raise TransitionRefused(
            "Seule une fiche en relecture peut être validée."
        )

    now = timezone.now()
    submission.status = Submission.Status.VALIDATED
    submission.validated_by = reviewer_profile
    submission.validated_at = now
    submission.save(update_fields=["status", "validated_by", "validated_at", "updated_at"])

    _event(
        submission,
        SubmissionEvent.Kind.VALIDATED,
        actor=getattr(reviewer_profile, "email", ""),
    )

    from outbound.services.queue import prepare_submission_confirmation

    prepare_submission_confirmation(submission)
    return submission


@transaction.atomic
def reopen(submission: Submission, reviewer_profile, reason: str) -> Submission:
    """Réouverture — le motif est obligatoire et part avec le message."""
    if not reason or not reason.strip():
        raise TransitionRefused(
            "Un motif est obligatoire : la personne qui a rempli la fiche doit savoir "
            "quoi corriger."
        )
    if submission.status not in (Submission.Status.SUBMITTED, Submission.Status.VALIDATED):
        raise TransitionRefused("Cette fiche n'est pas en état d'être réouverte.")

    submission.status = Submission.Status.REOPENED
    submission.reopen_reason = reason.strip()
    submission.save(update_fields=["status", "reopen_reason", "updated_at"])

    _event(
        submission,
        SubmissionEvent.Kind.REOPENED,
        actor=getattr(reviewer_profile, "email", ""),
        reason=submission.reopen_reason,
    )

    from outbound.services.queue import prepare_submission_reopened

    prepare_submission_reopened(submission)
    return submission
