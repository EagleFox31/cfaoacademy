"""Catalogue des types de messages — règles d'envoi par producteur."""
from __future__ import annotations

from dataclasses import dataclass


class Mode:
    AUTO = "AUTO"
    TRANSACTIONAL = "TRANSACTIONAL"
    REVIEW = "REVIEW"


LOCALES = ("fr", "en", "pt")  # langues servies : serializer, gabarits amorcés, contrat


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
    # Message sensible (code, lien de connexion) : les champs de `secret_context`
    # ne sont jamais stockés en clair, le message expire et ne se renvoie pas.
    sensitive: bool = False
    secret_context: tuple[str, ...] = ()
    # Vide = toute clé service. Renseigné : seules les clés liées à ces sources.
    allowed_sources: tuple[str, ...] = ()
    # Format exigé de certains champs (expression complète), publié dans le contrat.
    context_patterns: tuple[tuple[str, str], ...] = ()


# Messages de Keycloak (extension cfao-hub). Le lien d'action est un secret, comme le code.
IDENTITY_SOURCES = ("cfao-identity",)
MINUTES = r"[1-9][0-9]{0,3}"
LINK_CONTEXT = ("display_name", "module_url", "link_minutes")


def _identity_link(key: str, description: str) -> MessageType:
    return MessageType(
        key=key,
        audience=Audience.EXTERNAL,
        mode=Mode.TRANSACTIONAL,
        subject_key=key,
        description=description,
        required_context=LINK_CONTEXT,
        sensitive=True,
        secret_context=("module_url",),
        allowed_sources=IDENTITY_SOURCES,
        context_patterns=(("link_minutes", MINUTES),),
    )


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
    # ── Identité (Keycloak, sensibles sauf l'alerte support) ────────────────
    MessageType(
        key="identity.login_code",
        audience=Audience.EXTERNAL,
        mode=Mode.TRANSACTIONAL,
        subject_key="identity.login_code",
        description="Connexion par mail : code à 6 chiffres et bouton de connexion.",
        required_context=("display_name", "code", "code_minutes", "module_url", "link_minutes"),
        sensitive=True,
        secret_context=("code", "module_url"),
        allowed_sources=IDENTITY_SOURCES,
        context_patterns=(("code", r"[0-9]{6}"), ("code_minutes", MINUTES), ("link_minutes", MINUTES)),
    ),
    _identity_link("identity.password_reset", "Mot de passe oublié : lien pour en choisir un nouveau."),
    _identity_link("identity.execute_actions", "Actions demandées par un administrateur (mot de passe, profil)."),
    _identity_link("identity.verify_email", "Confirmation de l'adresse mail du compte."),
    MessageType(
        key="identity.login_support_alert",
        audience=Audience.INTERNAL,
        mode=Mode.AUTO,
        subject_key="identity.login_support_alert",
        description="Support : demande de connexion sans suite (1 par adresse et par jour via correlation_id).",
        required_context=("entered_email", "request", "problem"),
        allowed_sources=IDENTITY_SOURCES,
        context_patterns=(("entered_email", r"[^\s@]{1,64}@[^\s@]{1,190}"),),
    ),
)

BY_KEY: dict[str, MessageType] = {m.key: m for m in MESSAGE_TYPES}


class UnsafeAutoSend(Exception):
    pass


def assert_catalog_is_safe(types: tuple[MessageType, ...] = MESSAGE_TYPES) -> None:
    offenders = [
        m.key for m in types
        if m.audience == Audience.EXTERNAL and m.mode == Mode.AUTO
    ]
    if offenders:
        raise UnsafeAutoSend(
            "Envoi AUTO interdit vers l'extérieur : "
            + ", ".join(offenders)
            + ". Utiliser TRANSACTIONAL ou REVIEW."
        )
    for m in types:
        unknown_patterns = {field for field, _ in m.context_patterns} - set(m.required_context)
        if unknown_patterns:
            raise UnsafeAutoSend(f"« {m.key} » : format déclaré hors des champs requis ({', '.join(sorted(unknown_patterns))}).")
        if m.secret_context and not m.sensitive:
            raise UnsafeAutoSend(f"« {m.key} » a des champs secrets sans être sensible.")
        if not m.sensitive:
            continue
        # Un message relu attendrait un humain qui verrait le secret : interdit.
        if m.mode != Mode.TRANSACTIONAL:
            raise UnsafeAutoSend(f"Message sensible « {m.key} » : mode TRANSACTIONAL obligatoire.")
        if not m.secret_context:
            raise UnsafeAutoSend(f"Message sensible « {m.key} » sans champ secret déclaré.")
        if not m.allowed_sources:
            raise UnsafeAutoSend(f"Message sensible « {m.key} » sans source autorisée.")
        unknown = set(m.secret_context) - set(m.required_context)
        if unknown:
            raise UnsafeAutoSend(
                f"Message sensible « {m.key} » : secrets hors des champs requis ({', '.join(sorted(unknown))})."
            )


def is_internal_recipient(email: str, internal_domains: list[str]) -> bool:
    domain = email.rsplit("@", 1)[-1].lower().strip()
    return any(domain == d.lower().strip() for d in internal_domains)
