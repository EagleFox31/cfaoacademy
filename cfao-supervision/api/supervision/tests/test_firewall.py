"""Lecture du journal ufw : refus, rotation, rejeu, regroupement, alerte, vue."""
import os
from datetime import datetime, timedelta, timezone

import pytest

from supervision.collectors import firewall
from supervision.models import CollectRun, RefusedAttempt

NOW = datetime(2026, 11, 20, 9, 30, tzinfo=timezone.utc)


def block(src="192.168.10.133", dport=8444, at="2026-11-20T09:17:29.797584+00:00", dst="192.168.10.155",
          tag="BLOCK"):
    return (f"{at} academy-server kernel: [UFW {tag}] IN=eno1 OUT= MAC=e4:e7 SRC={src} DST={dst} LEN=52 "
            f"TOS=0x00 PROTO=TCP SPT=5902 DPT={dport} WINDOW=65535 RES=0x00 SYN URGP=0 \n")


@pytest.fixture
def log(tmp_path, settings):
    path = tmp_path / "ufw.log"
    path.write_text("")
    settings.UFW_LOG_PATH = str(path)
    settings.REFUSED_ALERT_THRESHOLD = 3
    settings.REFUSED_ALERT_WINDOW_MIN = 60
    settings.REFUSED_RETENTION_DAYS = 7
    return path


def append(path, *lines):
    with open(path, "a", encoding="utf-8", newline="") as handle:
        handle.write("".join(lines))


# ── Analyse d'une ligne ──

def test_parse_block_line():
    at, src, port, proto = firewall.parse_line(block())
    assert (src, port, proto) == ("192.168.10.133", 8444, "TCP")
    assert at == datetime(2026, 11, 20, 9, 17, 29, 797584, tzinfo=timezone.utc)


@pytest.mark.parametrize("line", [
    block(tag="ALLOW"), block(tag="AUDIT"), block(dst="224.0.0.251"), block(dst="255.255.255.255"),
    block(src="pas-une-ip"), "texte quelconque\n", block(at="pas-une-date"),
])
def test_parse_ignores_noise(line):
    assert firewall.parse_line(line) is None


def test_parse_limit_block():
    assert firewall.parse_line(block(tag="LIMIT BLOCK"))[1] == "192.168.10.133"


# ── Lecture incrémentale ──

@pytest.mark.django_db
def test_replay_adds_nothing(log):
    append(log, block(), block())
    assert firewall.collect(now=NOW)["refused"] == 2
    assert firewall.collect(now=NOW)["refused"] == 0
    assert sum(r.count for r in RefusedAttempt.objects.all()) == 2


@pytest.mark.django_db
def test_partial_line_waits_for_newline(log):
    append(log, block(), block()[:40])
    assert firewall.collect(now=NOW)["refused"] == 1
    append(log, block()[40:])
    assert firewall.collect(now=NOW)["refused"] == 1


@pytest.mark.django_db
def test_rotation_reads_end_of_old_file(log):
    append(log, block())
    firewall.collect(now=NOW)
    append(log, block(src="192.168.10.20"))  # écrit juste avant la rotation
    os.replace(log, f"{log}.1")
    log.write_text("")
    append(log, block(src="192.168.10.21"))
    assert firewall.collect(now=NOW)["refused"] == 2
    assert set(RefusedAttempt.objects.values_list("src_ip", flat=True)) == {
        "192.168.10.133", "192.168.10.20", "192.168.10.21"}


@pytest.mark.django_db
def test_truncated_file_restarts(log):
    append(log, block(), block(), block())
    firewall.collect(now=NOW)
    log.write_text(block(src="192.168.10.9"))
    assert firewall.collect(now=NOW)["refused"] == 1


@pytest.mark.django_db
def test_missing_file_keeps_cursor(log):
    append(log, block())
    firewall.collect(now=NOW)
    cursor = CollectRun.objects.get(source="firewall").cursor
    log.unlink()
    assert firewall.collect(now=NOW)["lines"] == 0
    assert CollectRun.objects.get(source="firewall").cursor == cursor


@pytest.mark.django_db
def test_lines_older_than_retention_ignored(log):
    append(log, block(at="2026-11-01T10:00:00+00:00"), block())
    assert firewall.collect(now=NOW)["refused"] == 1


@pytest.mark.django_db
def test_purge_forgets_ip_after_retention(log):
    append(log, block())
    firewall.collect(now=NOW)
    assert firewall.purge(now=NOW + timedelta(days=6)) == 0
    assert firewall.purge(now=NOW + timedelta(days=8)) == 1


# ── Regroupement et alerte ──

@pytest.mark.django_db
def test_summary_groups_by_network_and_alerts(log):
    append(log, *[block(at="2026-11-20T09:20:00+00:00") for _ in range(3)],
           block(src="192.168.10.40", dport=8092, at="2026-11-20T09:21:00+00:00"),
           block(src="10.0.0.5", at="2026-11-20T06:00:00+00:00"))
    firewall.collect(now=NOW)
    data = firewall.summary(now=NOW)
    assert data["alerts"] == 1 and data["total"] == 5
    lan, other = data["networks"]
    assert lan["network"] == "192.168.10.0/24" and lan["alert"] and lan["addresses"] == 2
    assert lan["ips"][0]["ip"] == "192.168.10.133" and lan["ips"][0]["alert"]
    assert not lan["ips"][1]["alert"] and lan["ips"][1]["ports"] == [8092]
    # Hors de la fenêtre d'alerte : compté sur 24 h, pas en alerte.
    assert other["network"] == "10.0.0.0/24" and other["recent"] == 0 and not other["alert"]


@pytest.mark.django_db
def test_network_alert_without_single_ip_alert(log):
    append(log, *[block(src=f"192.168.10.{n}", at="2026-11-20T09:20:00+00:00") for n in (1, 2, 3)])
    firewall.collect(now=NOW)
    net = firewall.summary(now=NOW)["networks"][0]
    assert net["alert"] and not any(ip["alert"] for ip in net["ips"])


# ── Vue ──

@pytest.mark.django_db
def test_refused_view_rights(ops, trainer):
    assert trainer.get("/api/v1/supervision/refused").status_code == 403
    body = ops.get("/api/v1/supervision/refused?hours=999").json()
    assert body["hours"] == 168 and body["source"] is None and body["networks"] == []


@pytest.mark.django_db
def test_overview_carries_refused_summary(ops, log):
    append(log, *[block(at=datetime.now(timezone.utc).isoformat()) for _ in range(3)])
    firewall.collect()
    refused = ops.get("/api/v1/supervision/overview").json()["refused"]
    assert refused == {"alerts": 1, "recent": 3}


def test_source_only_when_log_configured(settings):
    from supervision.management.commands.collect import sources

    settings.UFW_LOG_PATH = ""
    assert "firewall" not in sources()
    settings.UFW_LOG_PATH = "/host/log/ufw.log"
    assert "firewall" in sources()


def test_compose_prod_journal_ufw_en_lecture_seule_pour_le_collecteur_seul():
    """Le dossier ufw : lecture seule, groupe adm, et uniquement dans le collecteur."""
    from pathlib import Path
    import re

    text = (Path(__file__).resolve().parents[3] / "docker-compose.prod.yml").read_text(encoding="utf-8")
    services = dict(re.findall(r"(?m)^  ([a-z-]+):\n((?:(?:    .*)?\n)+)", text))
    collector = services["supervision-collector"]
    assert "SUPERVISION_UFW_LOG_PATH: /var/log/cfao-ufw/ufw.log" in collector
    assert re.search(r"(?m)^      - \$\{SUPERVISION_UFW_DIR:-/var/log/cfao-ufw\}:/var/log/cfao-ufw:ro$", collector)
    assert 'group_add: ["4"]' in collector
    for name, body in services.items():
        if name != "supervision-collector":
            assert "cfao-ufw" not in body and "group_add" not in body, name
