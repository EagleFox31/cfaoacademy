"""Le circuit à validation — la règle distinctive du module.

« Aucun email ne part vers une filiale sans qu'un membre de l'équipe Academy l'ait
validé dans la plateforme » (docs/SPEC_RECUEIL_BESOINS_2027.md §7.0).

Ces tests vérifient que la règle tient par construction, pas par convention.
"""
import pytest
from django.test import override_settings

from campaigns.models import Campaign, Submission, SubmissionCc
from campaigns.services.transitions import submit, validate
from outbound.catalog import MESSAGE_TYPES, Audience, Mode, UnsafeAutoSend, assert_catalog_is_safe
from outbound.models import EmailSendLog, OutboundMessage
from outbound.services.backends import LocMemBackend
from outbound.services.queue import ForbiddenAutoSend, enqueue
from outbound.services.sender import NotApproved, send_message
from referential.models import OrgUnitRef, UserProfile

pytestmark = pytest.mark.django_db


@pytest.fixture
def campaign():
    return Campaign.objects.create(
        year=2027, label="Campagne 2027", status=Campaign.Status.OPEN
    )


@pytest.fixture
def douala():
    return OrgUnitRef.objects.create(
        code="cmr-douala", label="CFAO Cameroun — Douala",
        country="Cameroun", org_path=["groupe", "groupe.cmr", "groupe.cmr.douala"],
    )


@pytest.fixture
def manager(douala):
    return UserProfile.objects.create(
        keycloak_sub="sub-manager", email="chef.atelier@filiale-cmr.example",
        display_name="Chef d'atelier Douala", org_unit=douala,
        roles=["team_manager"], locale="fr",
    )


@pytest.fixture
def reviewer():
    return UserProfile.objects.create(
        keycloak_sub="sub-assistante", email="assistante@cfao.com",
        display_name="Assistante centre", roles=["center_assistant"],
    )


@pytest.fixture
def submission(campaign, douala, manager):
    submission = Submission.objects.create(
        campaign=campaign, org_unit=douala, country="Cameroun"
    )
    SubmissionCc.objects.create(submission=submission, email="directeur@filiale-cmr.example")
    return submission


# ── la règle, vérifiée au démarrage ──────────────────────────────────────────


def test_le_catalogue_nautorise_aucun_envoi_auto_vers_lexterieur():
    """Interdit n° 11 — vérifié au boot par OutboundConfig.ready()."""
    assert_catalog_is_safe()  # ne lève pas

    externes_en_auto = [
        m.key for m in MESSAGE_TYPES if m.audience == Audience.EXTERNAL and m.mode == Mode.AUTO
    ]
    assert externes_en_auto == []


def test_un_catalogue_mal_configure_fait_echouer_le_demarrage(monkeypatch):
    from dataclasses import replace

    import outbound.catalog as catalog

    piege = replace(catalog.BY_KEY["submission_confirmed"], mode=Mode.AUTO)
    monkeypatch.setattr(catalog, "MESSAGE_TYPES", (piege,))

    with pytest.raises(UnsafeAutoSend) as exc:
        catalog.assert_catalog_is_safe()
    assert "submission_confirmed" in str(exc.value)


# ── le circuit de bout en bout ───────────────────────────────────────────────


@override_settings(ACADEMY_TEAM_RECIPIENTS=["academy@cfao.com"])
def test_soumettre_nenvoie_rien_a_la_filiale(submission, manager):
    """Étape ① → ② : seul un message INTERNE est créé, et il est déjà approuvé."""
    submit(submission, manager)

    messages = OutboundMessage.objects.all()
    assert messages.count() == 1

    interne = messages.get()
    assert interne.kind == "internal_submission_summary"
    assert interne.to == ["academy@cfao.com"]
    assert interne.status == OutboundMessage.Status.APPROVED

    # Rien vers la filiale, ni vers ses destinataires en copie.
    assert not OutboundMessage.objects.filter(kind="submission_confirmed").exists()


@override_settings(ACADEMY_TEAM_RECIPIENTS=["academy@cfao.com"])
def test_le_resume_interne_porte_un_lien_et_des_totaux_pas_la_fiche(submission, manager):
    submit(submission, manager)
    interne = OutboundMessage.objects.get(kind="internal_submission_summary")

    assert "review_url" in interne.context
    assert str(submission.id) in interne.context["review_url"]
    assert "summary" in interne.context
    assert "lines" not in interne.context  # le détail se lit dans l'outil


@override_settings(ACADEMY_TEAM_RECIPIENTS=["academy@cfao.com"])
def test_la_validation_prepare_la_confirmation_avec_les_cc(submission, manager, reviewer):
    """Étape ③ → ④ : la confirmation naît EN ATTENTE DE RELECTURE."""
    submit(submission, manager)
    validate(submission, reviewer)

    confirmation = OutboundMessage.objects.get(kind="submission_confirmed")
    assert confirmation.to == [manager.email]
    assert confirmation.cc == ["directeur@filiale-cmr.example"]
    assert confirmation.status == OutboundMessage.Status.PENDING_REVIEW


def test_un_message_externe_naît_toujours_en_attente_de_relecture(submission):
    message = enqueue(
        "submission_confirmed",
        to=["chef.atelier@filiale-cmr.example"],
        submission=submission,
    )
    assert message.status == OutboundMessage.Status.PENDING_REVIEW


@override_settings(ACADEMY_INTERNAL_DOMAINS=["cfao.com"])
def test_un_type_interne_avec_un_destinataire_externe_bascule_en_relecture(submission):
    """Second garde-fou : le type déclare, mais ce sont les ADRESSES qui tranchent."""
    message = enqueue(
        "internal_submission_summary",
        to=["academy@cfao.com", "externe@partenaire.example"],
        submission=submission,
    )
    assert message.status == OutboundMessage.Status.PENDING_REVIEW


def test_envoyer_un_message_non_approuve_est_refuse(submission):
    message = enqueue(
        "submission_confirmed",
        to=["chef.atelier@filiale-cmr.example"],
        submission=submission,
    )
    with pytest.raises(NotApproved):
        send_message(message)


def test_sans_destinataire_on_ne_fabrique_pas_de_message_fantome(submission):
    with pytest.raises(ForbiddenAutoSend):
        enqueue("submission_confirmed", to=[], submission=submission)


# ── envoi effectif ───────────────────────────────────────────────────────────


def test_un_message_approuve_part_et_laisse_une_trace(submission, seeded_templates):
    LocMemBackend.outbox.clear()
    message = enqueue(
        "submission_confirmed",
        to=["chef.atelier@filiale-cmr.example"],
        cc=["directeur@filiale-cmr.example"],
        submission=submission,
        context={"display_name": "Chef d'atelier", "civility": "NEUTRE"},
    )
    message.status = OutboundMessage.Status.APPROVED
    message.save(update_fields=["status"])

    log = send_message(message)

    assert log.status == EmailSendLog.Status.SENT
    assert LocMemBackend.outbox[-1]["cc"] == ["directeur@filiale-cmr.example"]
    message.refresh_from_db()
    assert message.status == OutboundMessage.Status.SENT
    assert message.template_version == 1  # la version utilisée est figée


@pytest.fixture
def seeded_templates():
    from outbound.models import EmailTemplate

    for locale in ("fr", "en"):
        EmailTemplate.objects.create(
            key="submission.confirmed",
            locale=locale,
            version=1,
            subject="Votre Identification des Besoins",
            body_text="$greeting,\n\nVotre Identification des Besoins est enregistrée.",
            placeholders=["greeting"],
        )
