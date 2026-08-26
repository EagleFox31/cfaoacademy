"""Catalogue des messages — et la règle qui rend le circuit infalsifiable.

Principe (spec §7.0) : **aucun email ne part vers une filiale sans qu'un membre de
l'équipe Academy l'ait validé dans la plateforme.** Le seul envoi automatique est
interne : un résumé et un lien.

Le mode `AUTO` n'est donc ouvert qu'aux destinataires internes. Ce n'est pas une
consigne mais une **contrainte vérifiée au démarrage** : un message visant une
audience externe déclaré en `AUTO` fait échouer le boot (voir apps.py).
"""
from __future__ import annotations

from dataclasses import dataclass


class Mode:
    AUTO = "AUTO"        # part sans relecture — réservé à l'équipe Academy
    REVIEW = "REVIEW"    # passe par l'écran « À envoyer »


class Audience:
    INTERNAL = "INTERNAL"  # équipe Academy
    EXTERNAL = "EXTERNAL"  # filiales, managers, directeurs


@dataclass(frozen=True)
class MessageType:
    key: str
    audience: str
    mode: str
    subject_key: str
    description: str


MESSAGE_TYPES: tuple[MessageType, ...] = (
    # ── Interne : les seuls envois automatiques ──────────────────────────────
    MessageType(
        key="internal_submission_summary",
        audience=Audience.INTERNAL,
        mode=Mode.AUTO,
        subject_key="internal.submission_summary",
        description=(
            "Résumé d'une fiche soumise + lien profond vers la plateforme. "
            "Groupé après N minutes d'inactivité. Ne contient PAS le détail de la "
            "fiche : le détail se lit dans l'outil, là où la correction est possible."
        ),
    ),
    MessageType(
        key="internal_reminder_batch",
        audience=Audience.INTERNAL,
        mode=Mode.AUTO,
        subject_key="internal.reminder_batch",
        description="Filiales à relancer à cette échéance + lien vers « À envoyer ».",
    ),
    MessageType(
        key="internal_catalog_ready",
        audience=Audience.INTERNAL,
        mode=Mode.AUTO,
        subject_key="internal.catalog_ready",
        description="Une famille est passée de PENDING à READY : filiales à informer.",
    ),
    MessageType(
        key="internal_review_sla",
        audience=Audience.INTERNAL,
        mode=Mode.AUTO,
        subject_key="internal.review_sla",
        description="Fiches en attente de relecture depuis plus de N heures (story 16-19).",
    ),
    MessageType(
        key="campaign_digest",
        audience=Audience.INTERNAL,
        mode=Mode.AUTO,
        subject_key="internal.digest",
        description="Digest hebdomadaire équipe et MOA — le seul message désabonnable.",
    ),
    # ── Externe : tout passe par la relecture ────────────────────────────────
    MessageType(
        key="submission_confirmed",
        audience=Audience.EXTERNAL,
        mode=Mode.REVIEW,
        subject_key="submission.confirmed",
        description="Confirmation à l'auteur de la fiche, ses destinataires en copie.",
    ),
    MessageType(
        key="submission_reopened",
        audience=Audience.EXTERNAL,
        mode=Mode.REVIEW,
        subject_key="submission.reopened",
        description="Réouverture — motif obligatoire.",
    ),
    MessageType(
        key="campaign_opened",
        audience=Audience.EXTERNAL,
        mode=Mode.REVIEW,
        subject_key="campaign.opened",
        description="Ouverture de campagne annoncée aux saisisseurs.",
    ),
    MessageType(
        key="reminder_j21",
        audience=Audience.EXTERNAL,
        mode=Mode.REVIEW,
        subject_key="reminder.j21",
        description="Relance J-21.",
    ),
    MessageType(
        key="reminder_j10",
        audience=Audience.EXTERNAL,
        mode=Mode.REVIEW,
        subject_key="reminder.j10",
        description="Relance J-10.",
    ),
    MessageType(
        key="reminder_j3",
        audience=Audience.EXTERNAL,
        mode=Mode.REVIEW,
        subject_key="reminder.j3",
        description="Relance J-3.",
    ),
    MessageType(
        key="escalation_j1",
        audience=Audience.EXTERNAL,
        mode=Mode.REVIEW,
        subject_key="reminder.escalation",
        description="Escalade au directeur de filiale, copie équipe Academy.",
    ),
    MessageType(
        key="catalog_ready_notice",
        audience=Audience.EXTERNAL,
        mode=Mode.REVIEW,
        subject_key="campaign.catalog_ready",
        description="Une famille devient saisissable — information aux marques concernées.",
    ),
    MessageType(
        key="delegated_entry_notice",
        audience=Audience.EXTERNAL,
        mode=Mode.REVIEW,
        subject_key="submission.delegated",
        description="Information au manager dont la fiche a été saisie par un tiers.",
    ),
)

BY_KEY: dict[str, MessageType] = {m.key: m for m in MESSAGE_TYPES}


class UnsafeAutoSend(Exception):
    """Un message vers l'extérieur est déclaré en envoi automatique."""


def assert_catalog_is_safe() -> None:
    """Interdit n° 11 — vérifié au démarrage, pas laissé à la configuration.

    Sans ce garde-fou, un `mode = AUTO` posé par inadvertance sur
    `submission_confirmed` remettrait le module dans le modèle transactionnel que
    la MOA a explicitement écarté.
    """
    offenders = [
        m.key for m in MESSAGE_TYPES if m.audience == Audience.EXTERNAL and m.mode == Mode.AUTO
    ]
    if offenders:
        raise UnsafeAutoSend(
            "Envoi automatique interdit vers des destinataires hors équipe Academy : "
            + ", ".join(offenders)
            + ". Passez ces types en mode REVIEW (docs/SPEC_RECUEIL_BESOINS_2027.md §7.0)."
        )


def is_internal_recipient(email: str, internal_domains: list[str]) -> bool:
    domain = email.rsplit("@", 1)[-1].lower().strip()
    return any(domain == d.lower().strip() for d in internal_domains)
