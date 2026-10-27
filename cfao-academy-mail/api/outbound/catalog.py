"""Catalogue des types de messages — règles d'envoi par producteur."""
from __future__ import annotations

from dataclasses import dataclass


class Mode:
    AUTO = "AUTO"
    TRANSACTIONAL = "TRANSACTIONAL"
    REVIEW = "REVIEW"


class Audience:
    INTERNAL = "INTERNAL"
    EXTERNAL = "EXTERNAL"


# Phrase de formation + bouton. Le module fournit chaque valeur, le hub n'en invente aucune.
SESSION_CONTEXT = (
    "display_name",
    "brand",
    "session_code",
    "level",
    "training_title",
    "session_date",
    "country",
    "module_url",
)


@dataclass(frozen=True)
class MessageType:
    key: str
    audience: str
    mode: str
    subject_key: str
    description: str
    required_context: tuple[str, ...] = ()


MESSAGE_TYPES: tuple[MessageType, ...] = (
    # ── Needs (relecture filiale) ───────────────────────────────────────────
    MessageType(
        key="needs.submission_confirmed",
        audience=Audience.EXTERNAL,
        mode=Mode.REVIEW,
        subject_key="needs.submission.confirmed",
        description="Confirmation de fiche recueil des besoins.",
        required_context=("display_name",),
    ),
    MessageType(
        key="needs.campaign_opened",
        audience=Audience.EXTERNAL,
        mode=Mode.REVIEW,
        subject_key="needs.campaign.opened",
        description="Ouverture de campagne recueil.",
        required_context=("display_name",),
    ),
    MessageType(
        key="needs.internal_submission_summary",
        audience=Audience.INTERNAL,
        mode=Mode.AUTO,
        subject_key="needs.internal.submission_summary",
        description="Résumé interne Academy — fiche soumise.",
        required_context=("display_name",),
    ),
    # ── Comptes rendus formateur (transactionnel) ───────────────────────────
    MessageType(
        key="rapports.cr_to_document",
        audience=Audience.EXTERNAL,
        mode=Mode.TRANSACTIONAL,
        subject_key="rapports.cr_to_document",
        description="Rappel : comptes rendus à rédiger.",
        required_context=SESSION_CONTEXT + ("pending_count",),
    ),
    MessageType(
        key="rapports.cr_steps_missing",
        audience=Audience.EXTERNAL,
        mode=Mode.TRANSACTIONAL,
        subject_key="rapports.cr_steps_missing",
        description="Rappel : pages manquantes dans un brouillon.",
        required_context=SESSION_CONTEXT + ("missing_pages",),
    ),
    MessageType(
        key="rapports.cr_draft_stale",
        audience=Audience.EXTERNAL,
        mode=Mode.TRANSACTIONAL,
        subject_key="rapports.cr_draft_stale",
        description="Brouillon sans activité depuis N jours.",
        required_context=SESSION_CONTEXT + ("days_inactive",),
    ),
    # ── Core / ops (transactionnel) ─────────────────────────────────────────
    MessageType(
        key="core.session_reminder",
        audience=Audience.EXTERNAL,
        mode=Mode.TRANSACTIONAL,
        subject_key="core.session_reminder",
        description="Rappel session planifiée (J-7, etc.).",
        required_context=("display_name", "session_code", "session_date", "session_place"),
    ),
    MessageType(
        key="ops.ticket_resolved",
        audience=Audience.EXTERNAL,
        mode=Mode.TRANSACTIONAL,
        subject_key="ops.ticket_resolved",
        description="Ticket assistance clôturé.",
        required_context=("display_name",),
    ),
    MessageType(
        key="delivery.weekly_dev_reminder",
        audience=Audience.INTERNAL,
        mode=Mode.AUTO,
        subject_key="delivery.weekly_dev_reminder",
        description="Rappel jeudi — statut hebdo dev.",
        required_context=("display_name",),
    ),
)

BY_KEY: dict[str, MessageType] = {m.key: m for m in MESSAGE_TYPES}


class UnsafeAutoSend(Exception):
    pass


def assert_catalog_is_safe() -> None:
    offenders = [
        m.key for m in MESSAGE_TYPES
        if m.audience == Audience.EXTERNAL and m.mode == Mode.AUTO
    ]
    if offenders:
        raise UnsafeAutoSend(
            "Envoi AUTO interdit vers l'extérieur : "
            + ", ".join(offenders)
            + ". Utiliser TRANSACTIONAL ou REVIEW."
        )


def is_internal_recipient(email: str, internal_domains: list[str]) -> bool:
    domain = email.rsplit("@", 1)[-1].lower().strip()
    return any(domain == d.lower().strip() for d in internal_domains)
