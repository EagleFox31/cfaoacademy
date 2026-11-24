"""STARTTLS doit authentifier le serveur SMTP (certificat et nom d'hôte)."""

import ssl
from unittest import mock

from outbound.services.backends import SmtpBackend


def test_starttls_verifie_le_certificat(settings):
    settings.SMTP_USE_TLS = True
    with mock.patch("outbound.services.backends.smtplib.SMTP") as smtp:
        SmtpBackend().send(to=["a@example.com"], cc=[], subject="s", text="t", html="")
    client = smtp.return_value.__enter__.return_value
    context = client.starttls.call_args.kwargs["context"]
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname is True
