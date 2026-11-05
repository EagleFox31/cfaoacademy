from __future__ import annotations

import smtplib
from email.message import EmailMessage
from email.policy import SMTP
from typing import Protocol

from django.conf import settings


class EmailBackend(Protocol):
    def send(
        self, *, to: list[str], cc: list[str], subject: str, text: str, html: str, reply_to: str = "",
    ) -> None: ...


class ConsoleBackend:
    def send(self, *, to, cc, subject, text, html, reply_to="") -> None:
        print(f"[mail] to={to} cc={cc} reply_to={reply_to or '-'}\n  {subject}\n{text[:500]}")


class LocMemBackend:
    outbox: list[dict] = []

    def send(self, *, to, cc, subject, text, html, reply_to="") -> None:
        LocMemBackend.outbox.append(
            {
                "to": to,
                "cc": cc,
                "reply_to": reply_to,
                "subject": subject,
                "text": text,
                "html": html,
            },
        )


def build_message(*, sender: str, to, cc, subject: str, text: str, html: str, reply_to: str = "") -> EmailMessage:
    """MIME multipart, quoted-printable replié à 76 caractères (RFC 2045)."""
    message = EmailMessage(policy=SMTP.clone(max_line_length=76))
    message["From"] = sender
    message["To"] = ", ".join(to)
    if cc:
        message["Cc"] = ", ".join(cc)
    if reply_to:
        message["Reply-To"] = reply_to
    message["Subject"] = subject
    # Le relais smtp.cfao.corp est en 7 bits : les accents partent en quoted-printable.
    # Le repli « = » est retiré avant l'affichage, il ne coupe pas le bouton.
    message.set_content(text, charset="utf-8", cte="quoted-printable")
    if html:
        message.add_alternative(html, subtype="html", charset="utf-8", cte="quoted-printable")
    return message


class SmtpBackend:
    """Relais smtp.cfao.corp : port 25, sans login si aucun identifiant."""

    def send(self, *, to, cc, subject, text, html, reply_to="") -> None:
        message = build_message(
            sender=settings.EMAIL_FROM,
            to=to,
            cc=cc,
            subject=subject,
            text=text,
            html=html,
            reply_to=reply_to,
        )
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT) as client:
            if settings.SMTP_USE_TLS:
                client.starttls()
            if settings.SMTP_USERNAME:
                client.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
            client.send_message(message)


_BACKENDS = {
    "console": ConsoleBackend,
    "locmem": LocMemBackend,
    "smtp": SmtpBackend,
}


def get_backend() -> EmailBackend:
    return _BACKENDS.get(settings.EMAIL_BACKEND_KIND, ConsoleBackend)()
