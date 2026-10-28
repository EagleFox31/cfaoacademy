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
