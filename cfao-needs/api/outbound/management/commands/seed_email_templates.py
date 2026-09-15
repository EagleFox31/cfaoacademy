"""Amorçage des modèles d'emails — version 1, français et anglais.

Chaque type de message du catalogue (`outbound/catalog.py`) doit exister dans les
**deux** locales. L'absence d'une traduction est une erreur, pas un repli
silencieux : le test `test_templates_completeness.py` échoue si une clé manque.

Les modèles internes portent des **totaux et un lien**, jamais le détail de la
fiche : le détail se lit dans l'outil, là où la correction est possible.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from outbound.catalog import MESSAGE_TYPES
from outbound.models import EmailTemplate

LOCALES = ("fr", "en")

# clé → { locale: (objet, corps texte) }
TEMPLATES = {
    "internal.submission_summary": {
        "fr": (
            "Identification des Besoins reçue — $org_unit ($campaign_year)",
            "Une Identification des Besoins vient d'être transmise.\n\n"
            "Filiale : $org_unit ($country)\n"
            "Transmise par : $author\n"
            "Collaborateurs à former : $summary_total_headcount\n"
            "Formations retenues : $summary_trainings_selected\n"
            "Répartition : T1 $summary_by_quarter_q1 · T2 $summary_by_quarter_q2 · "
            "T3 $summary_by_quarter_q3 · T4 $summary_by_quarter_q4\n\n"
            "Relire et valider la fiche :\n$review_url\n\n"
            "Tant que la fiche n'est pas validée, aucun message n'est envoyé à la filiale.",
        ),
        "en": (
            "Needs Identification received — $org_unit ($campaign_year)",
            "A Needs Identification has just been sent.\n\n"
            "Subsidiary: $org_unit ($country)\n"
            "Sent by: $author\n"
            "Staff to train: $summary_total_headcount\n"
            "Courses selected: $summary_trainings_selected\n"
            "Split: Q1 $summary_by_quarter_q1 · Q2 $summary_by_quarter_q2 · "
            "Q3 $summary_by_quarter_q3 · Q4 $summary_by_quarter_q4\n\n"
            "Review and approve the entry:\n$review_url\n\n"
            "No message is sent to the subsidiary until the entry is approved.",
        ),
    },
    "internal.reminder_batch": {
        "fr": (
            "Relances à envoyer — échéance $deadline_label",
            "Les filiales suivantes n'ont pas encore transmis leur Identification des Besoins :\n\n"
            "$org_units\n\n"
            "Les messages sont préparés et vous attendent dans l'écran « À envoyer » :\n$outbox_url",
        ),
        "en": (
            "Reminders to send — $deadline_label deadline",
            "The following subsidiaries have not submitted yet:\n\n"
            "$org_units\n\n"
            "The messages are prepared and waiting in the “Ready to send” screen:\n$outbox_url",
        ),
    },
    "internal.catalog_ready": {
        "fr": (
            "Catalogue disponible — $family_label",
            "Le catalogue de la famille $family_label est désormais disponible : "
            "les filiales concernées peuvent saisir leurs besoins.\n\n"
            "Prévenir les filiales depuis l'écran « À envoyer » :\n$outbox_url",
        ),
        "en": (
            "Catalogue available — $family_label",
            "The $family_label catalogue is now available: the relevant subsidiaries "
            "can enter their needs.\n\n"
            "Notify them from the “Ready to send” screen:\n$outbox_url",
        ),
    },
    "internal.review_sla": {
        "fr": (
            "Fiches en attente de relecture depuis plus de $hours h",
            "Les fiches suivantes attendent une relecture :\n\n$submissions\n\n"
            "Une filiale sans réponse finit par relancer par téléphone : "
            "traiter ces fiches évite ce détour.\n\n$inbox_url",
        ),
        "en": (
            "Entries awaiting review for over $hours h",
            "The following entries are waiting for review:\n\n$submissions\n\n"
            "A subsidiary with no answer eventually calls: clearing these avoids that.\n\n$inbox_url",
        ),
    },
    "internal.digest": {
        "fr": (
            "Campagne $campaign_year — point hebdomadaire",
            "Avancement de la Mesure des Besoins en Formations au $date.\n\n"
            "Fiches validées : $validated\n"
            "En relecture : $in_review\n"
            "En saisie : $drafting\n"
            "Sans nouvelles : $silent\n\n"
            "Collaborateurs recensés à ce jour : $total_headcount\n\n$dashboard_url",
        ),
        "en": (
            "Campaign $campaign_year — weekly update",
            "Training Needs Measurement progress as of $date.\n\n"
            "Approved entries: $validated\n"
            "Under review: $in_review\n"
            "Being filled: $drafting\n"
            "No news: $silent\n\n"
            "Staff recorded to date: $total_headcount\n\n$dashboard_url",
        ),
    },
    "submission.confirmed": {
        "fr": (
            "Votre Identification des Besoins $campaign_year est enregistrée",
            "$greeting,\n\n"
            "Votre Identification des Besoins en Formations pour $org_unit a été relue par "
            "l'équipe CFAO Academy et enregistrée.\n\n"
            "Collaborateurs à former : $summary_total_headcount\n"
            "Formations retenues : $summary_trainings_selected\n"
            "Répartition : T1 $summary_by_quarter_q1 · T2 $summary_by_quarter_q2 · "
            "T3 $summary_by_quarter_q3 · T4 $summary_by_quarter_q4\n\n"
            "Ces éléments serviront à construire le calendrier des sessions $campaign_year. "
            "Nous reviendrons vers vous lors de l'ouverture des inscriptions.\n\n"
            "L'équipe CFAO Academy",
        ),
        "en": (
            "Your $campaign_year Needs Identification is recorded",
            "$greeting,\n\n"
            "Your Training Needs Identification for $org_unit has been reviewed by the "
            "CFAO Academy team and recorded.\n\n"
            "Staff to train: $summary_total_headcount\n"
            "Courses selected: $summary_trainings_selected\n"
            "Split: Q1 $summary_by_quarter_q1 · Q2 $summary_by_quarter_q2 · "
            "Q3 $summary_by_quarter_q3 · Q4 $summary_by_quarter_q4\n\n"
            "This will be used to build the $campaign_year session calendar. "
            "We will get back to you when registrations open.\n\n"
            "The CFAO Academy team",
        ),
    },
    "submission.reopened": {
        "fr": (
            "Votre Identification des Besoins $campaign_year est à compléter",
            "$greeting,\n\n"
            "Après relecture, votre Identification des Besoins pour $org_unit nécessite une correction :\n\n"
            "$reason\n\n"
            "Vous pouvez la reprendre ici :\n$entry_url\n\n"
            "L'équipe CFAO Academy",
        ),
        "en": (
            "Your $campaign_year Needs Identification is to be completed",
            "$greeting,\n\n"
            "After review, your Needs Identification for $org_unit needs a correction:\n\n"
            "$reason\n\n"
            "You can update it here:\n$entry_url\n\n"
            "The CFAO Academy team",
        ),
    },
    "campaign.opened": {
        "fr": (
            "Identification des Besoins en Formations $campaign_year — c'est ouvert",
            "$greeting,\n\n"
            "L'Identification des Besoins en Formations pour l'exercice $campaign_year est ouverte. "
            "Merci d'indiquer, pour chaque formation de votre périmètre, le nombre de "
            "collaborateurs à former par trimestre et le lieu souhaité.\n\n"
            "Date limite : $deadline\n\n"
            "Accéder au formulaire :\n$entry_url\n\n"
            "L'équipe CFAO Academy",
        ),
        "en": (
            "$campaign_year Training Needs Identification is open",
            "$greeting,\n\n"
            "Training Needs Identification for $campaign_year is open. For each course in "
            "your scope, please state how many staff to train per quarter and where.\n\n"
            "Deadline: $deadline\n\n"
            "Open the form:\n$entry_url\n\n"
            "The CFAO Academy team",
        ),
    },
    "reminder.j21": {
        "fr": (
            "Besoins en Formations $campaign_year — trois semaines avant la clôture",
            "$greeting,\n\n"
            "La Mesure des Besoins en Formations $campaign_year se termine le $deadline. "
            "Votre Identification des Besoins pour $org_unit n'est pas encore transmise.\n\n$entry_url\n\n"
            "L'équipe CFAO Academy",
        ),
        "en": (
            "$campaign_year Training Needs — three weeks to go",
            "$greeting,\n\n"
            "The $campaign_year Training Needs Measurement closes on $deadline. Your Needs "
            "Identification for $org_unit has not been sent yet.\n\n$entry_url\n\n"
            "The CFAO Academy team",
        ),
    },
    "reminder.j10": {
        "fr": (
            "Besoins en Formations $campaign_year — dix jours avant la clôture",
            "$greeting,\n\n"
            "Il reste dix jours pour transmettre les Besoins en Formations de $org_unit. "
            "Au-delà du $deadline, les demandes ne pourront plus être prises en compte "
            "dans le calendrier $campaign_year.\n\n$entry_url\n\n"
            "L'équipe CFAO Academy",
        ),
        "en": (
            "$campaign_year Training Needs — ten days to go",
            "$greeting,\n\n"
            "Ten days left to send the Training Needs for $org_unit. After $deadline, requests "
            "can no longer be included in the $campaign_year calendar.\n\n$entry_url\n\n"
            "The CFAO Academy team",
        ),
    },
    "reminder.j3": {
        "fr": (
            "Besoins en Formations $campaign_year — clôture dans trois jours",
            "$greeting,\n\n"
            "La Mesure des Besoins en Formations ferme le $deadline. Sans Identification "
            "des Besoins de $org_unit, aucune place "
            "ne sera réservée pour vos équipes en $campaign_year.\n\n$entry_url\n\n"
            "L'équipe CFAO Academy",
        ),
        "en": (
            "$campaign_year Training Needs — closing in three days",
            "$greeting,\n\n"
            "The Training Needs Measurement closes on $deadline. Without a Needs "
            "Identification from $org_unit, no "
            "seats will be reserved for your teams in $campaign_year.\n\n$entry_url\n\n"
            "The CFAO Academy team",
        ),
    },
    "reminder.escalation": {
        "fr": (
            "Besoins en Formations $campaign_year — $org_unit n'a pas répondu",
            "$greeting,\n\n"
            "La Mesure des Besoins en Formations $campaign_year est close depuis le $deadline "
            "et aucune Identification des Besoins n'a été reçue pour $org_unit.\n\n"
            "Sans retour de votre part, aucune place ne sera réservée pour cette filiale "
            "dans le calendrier $campaign_year. Nous restons disponibles pour ouvrir une "
            "saisie tardive si nécessaire.\n\n"
            "L'équipe CFAO Academy",
        ),
        "en": (
            "$campaign_year Training Needs — no reply from $org_unit",
            "$greeting,\n\n"
            "The $campaign_year Training Needs Measurement closed on $deadline and no Needs "
            "Identification was received for $org_unit.\n\n"
            "Without a reply, no seats will be reserved for this subsidiary in the "
            "$campaign_year calendar. We remain available to open a late entry if needed.\n\n"
            "The CFAO Academy team",
        ),
    },
    "campaign.catalog_ready": {
        "fr": (
            "Nouvelles formations disponibles — $family_label",
            "$greeting,\n\n"
            "Le catalogue $family_label est désormais disponible dans le formulaire. "
            "Vous pouvez compléter votre Identification des Besoins pour $org_unit.\n\n$entry_url\n\n"
            "L'équipe CFAO Academy",
        ),
        "en": (
            "New courses available — $family_label",
            "$greeting,\n\n"
            "The $family_label catalogue is now available in the form. "
            "You can complete your Needs Identification for $org_unit.\n\n$entry_url\n\n"
            "The CFAO Academy team",
        ),
    },
    "submission.delegated": {
        "fr": (
            "Une Identification des Besoins a été saisie pour $org_unit",
            "$greeting,\n\n"
            "À votre demande, $actor a saisi l'Identification des Besoins $campaign_year "
            "pour $org_unit. Vous pouvez la consulter et demander une correction :\n\n"
            "$entry_url\n\n"
            "L'équipe CFAO Academy",
        ),
        "en": (
            "A Needs Identification was entered for $org_unit",
            "$greeting,\n\n"
            "At your request, $actor entered the $campaign_year Needs Identification for "
            "$org_unit. You can review it and ask for a correction:\n\n$entry_url\n\n"
            "The CFAO Academy team",
        ),
    },
}


class Command(BaseCommand):
    help = "Charge les modèles d'emails (v1) en français et en anglais."

    @transaction.atomic
    def handle(self, *args, **options):
        expected = {m.subject_key for m in MESSAGE_TYPES}
        missing = sorted(expected - set(TEMPLATES))
        if missing:
            self.stdout.write(self.style.ERROR(
                "Types de message sans modèle : " + ", ".join(missing)
            ))

        created = 0
        for key, per_locale in TEMPLATES.items():
            for locale in LOCALES:
                subject, body = per_locale[locale]
                _, made = EmailTemplate.objects.update_or_create(
                    key=key, locale=locale, version=1,
                    defaults={
                        "subject": subject,
                        "body_text": body,
                        "placeholders": self._placeholders(subject, body),
                        "is_active": True,
                    },
                )
                created += int(made)

        total = len(TEMPLATES) * len(LOCALES)
        self.stdout.write(self.style.SUCCESS(
            f"Modèles d'emails chargés : {total} ({len(TEMPLATES)} clés × {len(LOCALES)} langues), "
            f"dont {created} nouveaux."
        ))

    @staticmethod
    def _placeholders(*texts: str) -> list[str]:
        import re

        found: set[str] = set()
        for text in texts:
            found.update(re.findall(r"\$([a-z_][a-z0-9_]*)", text))
        return sorted(found)
