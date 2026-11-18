import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]


def test_gateway_does_not_publish_enqueue():
    text = (REPO / "gateway" / "nginx.conf").read_text(encoding="utf-8")
    assert "location = /api/v1/mail/healthz" in text
    assert "location = /api/v1/mail/contract" in text
    assert "location /api/v1/mail/messages/" in text
    messages = text.split("location /api/v1/mail/messages/", 1)[1].split("location ", 1)[0]
    assert "return 403" in messages
    assert "proxy_pass" not in messages


def test_mail_ci_job_is_path_filtered():
    text = (REPO / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    assert "dorny/paths-filter@" in text
    assert "cfao-academy-mail/**" in text
    assert ".github/workflows/ci.yml" in text
    assert "needs.changes.outputs.mail" in text
    assert "workflow_dispatch" in text
    assert "workflow_call" in text
    # paths-filter lit les fichiers de la PR via l'API : sans ce droit, le job échoue sur GitHub.
    changes_job = text.split("\n  changes:\n", 1)[1].split("\n  cerbos:\n", 1)[0]
    assert "pull-requests: read" in changes_job


def test_mail_migrate_plans_the_sensitive_purge():
    """Sans ce job, les secrets échus ne sont jamais effacés (AGENTS.md §7)."""
    compose = (REPO / "cfao-academy-mail" / "docker-compose.yml").read_text(encoding="utf-8")
    migrate_job = re.split(r"\n  [\w-]+:\n|\n\S", compose.split("\n  mail-migrate:\n", 1)[1], maxsplit=1)[0]
    assert "migrate --noinput" in migrate_job
    assert "ensure_mail_schedules" in migrate_job


def test_sensitive_settings_are_documented_and_pinned():
    env = (REPO / "cfao-academy-mail" / ".env.example").read_text(encoding="utf-8")
    for name in ("MAIL_INBOUND_KEYS=", "MAIL_SEALED_CONTEXT_KEY=", "MAIL_SENSITIVE_MAX_TTL_MINUTES="):
        assert name in env
    requirements = (REPO / "cfao-academy-mail" / "api" / "requirements.txt").read_text(encoding="utf-8")
    assert "cryptography==" in requirements


def test_unknown_backend_fails_instead_of_printing_links(settings):
    import pytest
    from django.core.exceptions import ImproperlyConfigured

    from outbound.services.backends import ConsoleBackend, get_backend

    settings.EMAIL_BACKEND_KIND = "smpt"
    with pytest.raises(ImproperlyConfigured):
        get_backend()
    settings.EMAIL_BACKEND_KIND = "console"
    assert isinstance(get_backend(), ConsoleBackend)


def test_console_prints_the_whole_link(capsys):
    from outbound.services.backends import ConsoleBackend

    link = "https://kc.example/login-actions/action-token?key=" + "x" * 900
    ConsoleBackend().send(to=["a@cfao.com"], cc=[], subject="s", text=f"Bonjour\n{link}\n", html="")
    assert link in capsys.readouterr().out
