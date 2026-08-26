"""Mise en file des envois — le point de passage obligé.

Toute intention d'envoi passe par `enqueue()`. C'est ce qui garantit qu'un message
vers une filiale ne peut pas court-circuiter la relecture : il n'existe pas d'autre
chemin vers l'expéditeur.
"""
from __future__ import annotations

from django.conf import settings
from django.utils import timezone

from outbound.catalog import BY_KEY, Audience, Mode, is_internal_recipient
from outbound.models import OutboundMessage


class ForbiddenAutoSend(Exception):
    """Tentative d'envoi automatique vers un destinataire externe."""


def enqueue(
    kind: str,
    to: list[str],
    *,
    cc: list[str] | None = None,
    campaign=None,
    submission=None,
    locale: str = "fr",
    context: dict | None = None,
) -> OutboundMessage:
    """Crée le message dans le bon statut selon son type et ses destinataires.

    Double garde-fou :
      1. le type déclare son audience et son mode (outbound/catalog.py) ;
      2. **les destinataires réels sont vérifiés ici** — un type interne dont la
         liste contient une adresse externe bascule en relecture au lieu de partir.

    Le second contrôle existe parce que le premier repose sur une déclaration, et
    qu'une liste de destinataires vient de la configuration ou de la base.
    """
    message_type = BY_KEY.get(kind)
    if message_type is None:
        raise ForbiddenAutoSend(f"Type de message inconnu : {kind}")

    recipients = [address for address in (to or []) if address]
    copies = [address for address in (cc or []) if address]
    if not recipients:
        raise ForbiddenAutoSend(f"Aucun destinataire pour « {kind} ».")

    internal_domains = settings.ACADEMY_INTERNAL_DOMAINS
    all_internal = all(
        is_internal_recipient(address, internal_domains) for address in recipients + copies
    )

    auto = (
        message_type.mode == Mode.AUTO
        and message_type.audience == Audience.INTERNAL
        and all_internal
    )

    return OutboundMessage.objects.create(
        kind=kind,
        status=OutboundMessage.Status.APPROVED if auto else OutboundMessage.Status.PENDING_REVIEW,
        campaign=campaign or (submission.campaign if submission else None),
        submission=submission,
        to=recipients,
        cc=copies,
        locale=locale,
        context=context or {},
    )


# ── Points d'entrée métier ───────────────────────────────────────────────────


def schedule_internal_summary(submission) -> None:
    """Étape ② du circuit : résumé + lien profond, vers l'équipe Academy.

    Regroupé après N minutes d'inactivité (spec §7.5) : une filiale qui ajuste sa
    fiche trois fois dans l'heure produit un seul email, pas trois. Le regroupement
    est porté par la tâche planifiée `outbound.tasks.flush_internal_summaries`, qui
    lit `submission.last_activity_at`.
    """
    from campaigns.services.summary import submission_summary

    recipients = settings.ACADEMY_TEAM_RECIPIENTS
    if not recipients:
        # Pas de destinataire configuré : on ne fabrique pas un message fantôme.
        return

    enqueue(
        "internal_submission_summary",
        to=list(recipients),
        submission=submission,
        context={
            "org_unit": submission.org_unit.label,
            "country": submission.country,
            "campaign_year": submission.campaign.year,
            "author": getattr(submission.submitted_by, "display_name", ""),
            "summary": submission_summary(submission),
            # Le détail se lit dans l'outil, là où la correction est possible.
            "review_url": submission_url(submission),
            "submitted_at": timezone.now().isoformat(),
        },
    )


def prepare_submission_confirmation(submission) -> OutboundMessage | None:
    """Étape ④ : confirmation à l'auteur, ses CC en copie. En attente de relecture."""
    author = submission.submitted_by
    if not author or not author.email:
        return None

    from campaigns.services.summary import submission_summary

    return enqueue(
        "submission_confirmed",
        to=[author.email],
        cc=[cc.email for cc in submission.cc.all()],
        submission=submission,
        locale=author.locale or submission.campaign.default_locale,
        context={
            "civility": author.civility,
            "display_name": author.display_name,
            "org_unit": submission.org_unit.label,
            "campaign_year": submission.campaign.year,
            "summary": submission_summary(submission),
        },
    )


def prepare_submission_reopened(submission) -> OutboundMessage | None:
    author = submission.submitted_by
    if not author or not author.email:
        return None

    return enqueue(
        "submission_reopened",
        to=[author.email],
        cc=[cc.email for cc in submission.cc.all()],
        submission=submission,
        locale=author.locale or submission.campaign.default_locale,
        context={
            "civility": author.civility,
            "display_name": author.display_name,
            "org_unit": submission.org_unit.label,
            "reason": submission.reopen_reason,
            "entry_url": submission_url(submission),
        },
    )


def submission_url(submission) -> str:
    base = settings.PUBLIC_BASE_URL.rstrip("/")
    return f"{base}/campagnes/{submission.campaign.year}/fiches/{submission.id}"
