"""Journal de Caddy : poignées TLS ratées, redirections sans suite, minimisation, vue."""
import json
from datetime import datetime, timedelta, timezone

import pytest

from supervision.collectors import entry
from supervision.models import EntryEvent

NOW = datetime(2026, 11, 20, 9, 30, tzinfo=timezone.utc)
PREFIX = "2026-11-20T09:00:00.000000+00:00 academy-server caddy[173593]: "


def at(minutes_ago: float) -> float:
    return (NOW - timedelta(minutes=minutes_ago)).timestamp()


def handshake(error, ip="192.168.10.133", ago=10):
    # Ligne réelle de Caddy 2.6.2 (logger http.stdlib, niveau debug).
    return PREFIX + json.dumps({"level": "debug", "ts": at(ago), "logger": "http.stdlib",
                                "msg": f"http: TLS handshake error from {ip}:54806: {error}"}) + "\n"


def access(status, ip="192.168.10.133", host="192.168.10.155:8092", ago=10):
    # Journal d'accès filtré : ni chemin, ni en-têtes.
    return PREFIX + json.dumps({"level": "info", "ts": at(ago), "logger": "http.log.access.log2",
                                "msg": "handled request",
                                "request": {"remote_ip": ip, "remote_port": "40338", "proto": "HTTP/1.1",
                                            "method": "GET", "host": host},
                                "duration": 0.02, "size": 0, "status": status}) + "\n"


@pytest.fixture
def log(tmp_path, settings):
    path = tmp_path / "caddy.log"
    path.write_text("")
    settings.CADDY_LOG_PATH = str(path)
    settings.CERT_ALERT_THRESHOLD = 3
    settings.REFUSED_ALERT_WINDOW_MIN = 60
    settings.REFUSED_RETENTION_DAYS = 7
    settings.REDIRECT_GRACE_S = 120
    return path


def append(path, *lines):
    with open(path, "a", encoding="utf-8", newline="") as handle:
        handle.write("".join(lines))


# ── Analyse d'une ligne ──

@pytest.mark.parametrize("error, kind", [
    ("remote error: tls: unknown certificate", "cert_refused"),          # Chromium, Edge
    ("remote error: tls: bad certificate", "cert_refused"),
    ("remote error: tls: unknown certificate authority", "cert_refused"),
    ("remote error: tls: protocol version not supported", "tls_failed"),
    ("local error: tls: bad record MAC", "tls_failed"),
])
def test_handshake_kinds(error, kind):
    _, ip, port, found = entry.parse_line(handshake(error))
    assert (ip, port, found) == ("192.168.10.133", None, kind)


@pytest.mark.parametrize("line", [
    handshake("EOF"), handshake("read tcp 1.2.3.4:443->5.6.7.8:1: i/o timeout"),
    handshake("remote error: tls: unknown certificate", ip="pas-une-ip"),
    PREFIX + '{"level":"info","ts":1,"logger":"tls","msg":"cleaning storage unit"}\n',
    PREFIX + "pas du json\n", "texte quelconque\n",
    access("pas un code"),
])
def test_noise_is_ignored(line):
    assert entry.parse_line(line) is None


def test_access_kinds_and_port():
    assert entry.parse_line(access(308))[2:] == (8092, "redirected")
    assert entry.parse_line(access(200, host="192.168.10.155:8444"))[2:] == (8444, "arrived")
    assert entry.parse_line(access(401, host="192.168.10.155:8444"))[3] == "arrived"
    assert entry.parse_line(handshake("remote error: tls: bad certificate", ip="[fe80::1]"))[1] == "fe80::1"


# ── Collecte ──

@pytest.mark.django_db
def test_replay_adds_nothing(log):
    append(log, handshake("remote error: tls: unknown certificate"), handshake("EOF"))
    assert entry.collect(now=NOW) == {"lines": 2, "kept": 1}
    assert entry.collect(now=NOW)["kept"] == 0
    assert EntryEvent.objects.get().count == 1


@pytest.mark.django_db
def test_arrivals_kept_only_for_suspects(log):
    append(log, access(200, ip="192.168.10.50", host="192.168.10.155:8444"))
    entry.collect(now=NOW)
    assert not EntryEvent.objects.exists()  # un poste sans souci ne laisse pas d'IP
    append(log, access(308), access(200, host="192.168.10.155:8445", ago=9))
    entry.collect(now=NOW)
    assert set(EntryEvent.objects.values_list("kind", flat=True)) == {"redirected", "arrived"}
    # Arrivée lue à une passe suivante : le poste est déjà suspect en base.
    append(log, access(200, host="192.168.10.155:8445", ago=1))
    entry.collect(now=NOW)
    assert EntryEvent.objects.filter(kind="arrived").count() == 2


@pytest.mark.django_db
def test_purge_after_retention(log):
    append(log, access(308))
    entry.collect(now=NOW)
    assert entry.purge(now=NOW + timedelta(days=6)) == 0
    assert entry.purge(now=NOW + timedelta(days=8)) == 1


# ── Résumé et alertes ──

@pytest.mark.django_db
def test_redirected_then_nothing_is_lost(log):
    append(log, access(308, ip="192.168.10.40"),                                   # perdu
           access(308, ip="192.168.10.41"), access(200, ip="192.168.10.41", ago=9),  # arrivé
           access(308, ip="192.168.10.42", ago=1))                                 # délai de grâce
    entry.collect(now=NOW)
    data = entry.summary(now=NOW)
    by_ip = {p["ip"]: p for p in data["postes"]}
    assert set(by_ip) == {"192.168.10.40"}
    assert by_ip["192.168.10.40"]["lost_after_redirect"] and by_ip["192.168.10.40"]["ports"] == [8092]
    assert data["alerts"] == 1


@pytest.mark.django_db
def test_certificate_refused_alerts_until_arrival(log):
    refused = "remote error: tls: unknown certificate"
    append(log, *[handshake(refused, ago=20 - i) for i in range(3)],
           handshake(refused, ip="192.168.10.60"))
    entry.collect(now=NOW)
    data = entry.summary(now=NOW)
    first = data["postes"][0]
    assert first["ip"] == "192.168.10.133" and first["stuck_on_certificate"] and first["cert_refused"] == 3
    assert first["network"] == "192.168.10.0/24"
    assert data["alerts"] == 1  # un seul refus : montré, sans alerte
    # L'utilisateur passe l'avertissement : le poste arrive, l'alerte tombe, la trace reste.
    append(log, access(200, host="192.168.10.155:8444", ago=5))
    entry.collect(now=NOW)
    first = next(p for p in entry.summary(now=NOW)["postes"] if p["ip"] == "192.168.10.133")
    assert not first["alert"] and first["arrived"]


@pytest.mark.django_db
def test_old_failures_do_not_alert(log):
    append(log, *[handshake("remote error: tls: bad certificate", ago=90 + i) for i in range(5)])
    entry.collect(now=NOW)
    data = entry.summary(now=NOW)
    assert data["alerts"] == 0 and data["postes"][0]["recent_failures"] == 0


# ── Vue, source, compose ──

@pytest.mark.django_db
def test_refused_view_carries_entry(ops, trainer):
    assert trainer.get("/api/v1/supervision/refused").status_code == 403
    body = ops.get("/api/v1/supervision/refused?hours=24").json()["entry"]
    assert body["postes"] == [] and body["source"] is None and body["threshold"] == 3


@pytest.mark.django_db
def test_overview_counts_stuck_postes(ops, log):
    five_minutes_ago = (NOW - datetime.now(timezone.utc)).total_seconds() / 60 + 5
    append(log, access(308, ago=five_minutes_ago))
    entry.collect()
    refused = ops.get("/api/v1/supervision/overview").json()["refused"]
    assert refused["entry_alerts"] == 1 and refused["alerts"] == 1


def test_source_only_when_caddy_log_configured(settings):
    from supervision.management.commands.collect import sources

    settings.CADDY_LOG_PATH = ""
    assert "caddy" not in sources()
    settings.CADDY_LOG_PATH = "/var/log/cfao-caddy/caddy.log"
    assert "caddy" in sources()


def test_compose_prod_journal_caddy_en_lecture_seule_pour_le_collecteur_seul():
    from pathlib import Path
    import re

    text = (Path(__file__).resolve().parents[3] / "docker-compose.prod.yml").read_text(encoding="utf-8")
    services = dict(re.findall(r"(?m)^  ([a-z-]+):\n((?:(?:    .*)?\n)+)", text))
    collector = services["supervision-collector"]
    assert "SUPERVISION_CADDY_LOG_PATH: /var/log/cfao-caddy/caddy.log" in collector
    assert re.search(r"(?m)^      - \$\{SUPERVISION_CADDY_DIR:-/var/log/cfao-caddy\}:/var/log/cfao-caddy:ro$",
                     collector)
    for name, body in services.items():
        if name != "supervision-collector":
            assert "cfao-caddy" not in body, name
