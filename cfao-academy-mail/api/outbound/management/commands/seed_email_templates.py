from django.core.management.base import BaseCommand
from django.db import transaction

from outbound.catalog import MESSAGE_TYPES
from outbound.models import EmailTemplate

LOCALES = ("fr", "en")

STUBS = {
    "rapports.cr_to_document": {
        "fr": (
            "Comptes rendus à rédiger",
            "$greeting,\n\nVous avez $pending_count compte(s) rendu(s) à finaliser.\n\n$module_url\n",
        ),
        "en": (
            "Training reports to complete",
            "$greeting,\n\nYou have $pending_count report(s) to complete.\n\n$module_url\n",
        ),
    },
    "rapports.cr_steps_missing": {
        "fr": (
            "Pages manquantes — $session_code",
            "$greeting,\n\nIl reste à compléter : $missing_pages\n\n$module_url\n",
        ),
        "en": (
            "Missing pages — $session_code",
            "$greeting,\n\nStill to complete: $missing_pages\n\n$module_url\n",
        ),
    },
    "rapports.cr_draft_stale": {
        "fr": (
            "Brouillon en attente — $session_code",
            "$greeting,\n\nVotre brouillon n'a pas été modifié depuis $days_inactive jours.\n\n$module_url\n",
        ),
        "en": (
            "Draft pending — $session_code",
            "$greeting,\n\nYour draft has been inactive for $days_inactive days.\n\n$module_url\n",
        ),
    },
    "core.session_reminder": {
        "fr": (
            "Rappel session — $session_code",
            "$greeting,\n\nSession le $session_date à $session_place.\n",
        ),
        "en": (
            "Session reminder — $session_code",
            "$greeting,\n\nSession on $session_date at $session_place.\n",
        ),
    },
}


class Command(BaseCommand):
    help = "Amorce les templates v1 (FR + EN) pour le catalogue mail."

    @transaction.atomic
    def handle(self, *args, **options):
        created = 0
        for message_type in MESSAGE_TYPES:
            key = message_type.subject_key
            stub = STUBS.get(key)
            for locale in LOCALES:
                if EmailTemplate.objects.filter(key=key, locale=locale).exists():
                    continue
                if stub:
                    subject, body = stub[locale]
                else:
                    subject = key.replace(".", " ").title()
                    body = f"$greeting,\n\n({key})\n"
                EmailTemplate.objects.create(
                    key=key,
                    locale=locale,
                    subject=subject,
                    body_text=body,
                    version=1,
                )
                created += 1
        self.stdout.write(self.style.SUCCESS(f"Templates créés : {created}"))
