"""Fournisseur d'envoi, abstrait derrière une interface.

SMTP interne en R0 ; bascule SES / Azure Communication Services sans toucher au
métier. Aucun envoi n'est jamais fait dans une requête HTTP — le worker consomme
la file (architecture.md §7).
"""
from __future__ import annotations

import smtplib
from email.message import EmailMessage
from typing import Protocol

from django.conf import settings


class EmailBackend(Protocol):
    def send(self, *, to: list[str], cc: list[str], subject: str, text: str, html: str) -> None: ...


class ConsoleBackend:
    """Développement — écrit sur la sortie standard, n'envoie rien."""

    def send(self, *, to, cc, subject, text, html) -> None:
        print(f"[email] to={to} cc={cc}\n  {subject}\n{text[:500]}")


class LocMemBackend:
    """Tests — conserve les messages en mémoire, aucun réseau."""

    outbox: list[dict] = []

    def send(self, *, to, cc, subject, text, html) -> None:
        LocMemBackend.outbox.append(
            {"to": to, "cc": cc, "subject": subject, "text": text, "html": html}
        )


class SmtpBackend:
    def send(self, *, to, cc, subject, text, html) -> None:
        message = EmailMessage()
        message["From"] = settings.EMAIL_FROM
        message["To"] = ", ".join(to)
        if cc:
            message["Cc"] = ", ".join(cc)
        message["Subject"] = subject
        message.set_content(text)
        if html:
            message.add_alternative(html, subtype="html")

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as client:
            if settings.SMTP_USE_TLS:
                client.starttls()
            client.send_message(message)


_BACKENDS = {
    "console": ConsoleBackend,
    "locmem": LocMemBackend,
    "smtp": SmtpBackend,
}


def get_backend() -> EmailBackend:
    return _BACKENDS.get(settings.EMAIL_BACKEND_KIND, ConsoleBackend)()
