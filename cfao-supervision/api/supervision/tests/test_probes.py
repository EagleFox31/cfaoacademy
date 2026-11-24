"""Sondes des adresses publiques : configuration, contenu (jamais un 200 seul), alerte, vue."""
import io
from datetime import datetime, timedelta, timezone

import pytest
import requests
import urllib3

from supervision.collectors import probes
from supervision.models import PublicProbe

NOW = datetime(2026, 11, 20, 14, 0, tzinfo=timezone.utc)
PORTAIL = "https://192.168.10.155:8444/"
ANCIEN = "http://192.168.10.155:8092/x"


class FakeResponse:
    def __init__(self, status=200, body=b"", headers=None):
        self.status_code = status
        self.headers = headers or {}
        self.raw = io.BytesIO(body)
        self.raw.read = lambda n, decode_content=True, _r=self.raw.read: _r(n)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeSession:
    """Réponses par URL ; une exception dans la table est levée."""

    def __init__(self, table):
        self.table = table
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        answer = self.table[url]
        if isinstance(answer, Exception):
            raise answer
        return answer


def page(title):
    return FakeResponse(200, f"<html><head>\n<title>\n  {title}\n</title></head><body>x</body></html>".encode())


@pytest.fixture
def configured(settings):
    settings.PROBES = f"{PORTAIL}|Excellence Technique ; {ANCIEN}|-> https://192.168.10.155:8444/cr/x"
    settings.PROBE_ALERT_AFTER = 2
    settings.PROBE_TIMEOUT_S = 5
    return settings


# ── Configuration ──

def test_parse_config_title_and_redirect():
    parsed = probes.parse_config(f"{PORTAIL}|Portail\n{ANCIEN}|->https://h/cr/x;  ;")
    assert parsed == [probes.Probe(PORTAIL, "Portail", False), probes.Probe(ANCIEN, "https://h/cr/x", True)]


@pytest.mark.parametrize("raw", ["https://h/", "https://h/|", "ftp://h/|x", "h:8444/|x", "https://h/|->",
                                 "https://h/|a;https://h/|b"])
def test_parse_config_refuses_bad_entries(raw):
    with pytest.raises(ValueError):
        probes.parse_config(raw)


def test_source_only_when_probes_configured(settings):
    from supervision.management.commands.collect import sources

    settings.PROBES = ""
    assert "probes" not in sources()
    settings.PROBES = f"{PORTAIL}|Portail"
    assert "probes" in sources()


# ── Une sonde ──

def test_title_matches_case_insensitive_and_entities():
    session = FakeSession({PORTAIL: page("CFAO Academy &mdash; Excellence technique Mobilit&eacute;")})
    result = probes.check(probes.Probe(PORTAIL, "excellence TECHNIQUE", False), session)
    assert result["ok"] is True
    assert result["detail"] == "CFAO Academy — Excellence technique Mobilité"
    kwargs = session.calls[0][1]
    assert kwargs["allow_redirects"] is False and kwargs["timeout"] == 5
    assert "Authorization" not in kwargs["headers"] and "cookies" not in kwargs


@pytest.mark.django_db
def test_200_with_another_title_fails(settings):
    settings.PROBE_TIMEOUT_S = 5
    session = FakeSession({PORTAIL: page("Identification des Besoins")})
    result = probes.check(probes.Probe(PORTAIL, "Excellence Technique", False), session)
    assert result == {**result, "ok": False, "status_code": 200, "reason": "", "detail": "Identification des Besoins"}


@pytest.mark.parametrize("response,reason,detail", [
    (FakeResponse(200, b"<html><body>repli</body></html>"), "no_title", ""),
    (FakeResponse(502, b"<title>Excellence Technique</title>"), "http", ""),
    (FakeResponse(307, headers={"Location": "https://h:8444/"}), "moved", "https://h:8444/"),
])
def test_title_probe_needs_a_200_with_the_title(settings, response, reason, detail):
    settings.PROBE_TIMEOUT_S = 5
    result = probes.check(probes.Probe(PORTAIL, "Excellence Technique", False), FakeSession({PORTAIL: response}))
    assert (result["ok"], result["reason"], result["detail"]) == (False, reason, detail)


@pytest.mark.parametrize("response,ok", [
    (FakeResponse(307, headers={"Location": "https://h/cr/x"}), True),
    (FakeResponse(308, headers={"Location": "https://h/cr/x"}), True),
    (FakeResponse(308, headers={"Location": "https://autre/cr/x"}), False),
    (FakeResponse(200, b"<title>x</title>"), False),
])
def test_redirect_probe_checks_exact_location(settings, response, ok):
    settings.PROBE_TIMEOUT_S = 5
    assert probes.check(probes.Probe(ANCIEN, "https://h/cr/x", True), FakeSession({ANCIEN: response}))["ok"] is ok


@pytest.mark.parametrize("exc,reason", [
    (requests.exceptions.SSLError("handshake"), "tls"),
    (requests.exceptions.ConnectTimeout("lent"), "timeout"),
    (requests.exceptions.ReadTimeout("lent"), "timeout"),
    (requests.exceptions.ConnectionError("refusé"), "connection"),
    (requests.exceptions.TooManyRedirects("?"), "error"),
])
def test_network_error_is_a_failure_with_a_reason(settings, exc, reason):
    settings.PROBE_TIMEOUT_S = 5
    result = probes.check(probes.Probe(PORTAIL, "x", False), FakeSession({PORTAIL: exc}))
    assert (result["ok"], result["status_code"], result["reason"]) == (False, None, reason)
    assert result["detail"] == exc.__class__.__name__  # gardé pour le diagnostic


@pytest.mark.parametrize("exc,reason", [
    (urllib3.exceptions.ReadTimeoutError(None, "/", "lent"), "timeout"),
    (urllib3.exceptions.ProtocolError("coupé"), "connection"),
    (urllib3.exceptions.DecodeError("gzip"), "error"),
])
def test_body_read_error_does_not_escape(settings, exc, reason):
    """La lecture du corps passe par urllib3, dont les exceptions ne sont pas celles de requests."""
    settings.PROBE_TIMEOUT_S = 5
    response = FakeResponse(200)

    def broken(n, decode_content=True):
        raise exc
    response.raw.read = broken
    result = probes.check(probes.Probe(PORTAIL, "x", False), FakeSession({PORTAIL: response}))
    assert (result["ok"], result["reason"]) == (False, reason)


def test_redirect_probe_reason(settings):
    settings.PROBE_TIMEOUT_S = 5
    probe = probes.Probe(ANCIEN, "https://h/cr/x", True)
    moved = probes.check(probe, FakeSession({ANCIEN: FakeResponse(308, headers={"Location": "https://autre/"})}))
    assert (moved["reason"], moved["detail"]) == ("moved", "https://autre/")
    served = probes.check(probe, FakeSession({ANCIEN: FakeResponse(200, b"<title>x</title>")}))
    assert (served["reason"], served["detail"], served["status_code"]) == ("http", "", 200)


# ── Collecte et alerte ──

def table(portail, ancien=None):
    return FakeSession({PORTAIL: portail,
                        ANCIEN: ancien or FakeResponse(307, headers={"Location": "https://192.168.10.155:8444/cr/x"})})


@pytest.mark.django_db
def test_collect_counts_consecutive_failures(configured):
    assert probes.collect(now=NOW, session=table(page("Excellence Technique"))) == {"probes": 2, "failing": 0}
    down = requests.exceptions.ConnectionError("refusé")
    probes.collect(now=NOW + timedelta(minutes=1), session=table(down))
    row = PublicProbe.objects.get(url=PORTAIL)
    assert (row.ok, row.fails, row.last_ok_at) == (False, 1, NOW)
    assert probes.summary()["alerts"] == 0  # un seul échec : pas encore d'alerte
    probes.collect(now=NOW + timedelta(minutes=2), session=table(down))
    assert probes.summary()["alerts"] == 1
    probes.collect(now=NOW + timedelta(minutes=3), session=table(page("Excellence Technique")))
    assert PublicProbe.objects.get(url=PORTAIL).fails == 0
    assert probes.summary()["alerts"] == 0


@pytest.mark.django_db
def test_collect_forgets_removed_probes_and_keeps_order(configured):
    probes.collect(now=NOW, session=table(page("Excellence Technique")))
    configured.PROBES = f"{ANCIEN}|-> https://192.168.10.155:8444/cr/x"
    probes.collect(now=NOW, session=table(page("x")))
    assert list(PublicProbe.objects.values_list("url", flat=True)) == [ANCIEN]


@pytest.mark.django_db
def test_changed_expectation_resets_history(configured):
    probes.collect(now=NOW, session=table(page("Excellence Technique")))
    configured.PROBES = f"{PORTAIL}|Identification des Besoins"
    probes.collect(now=NOW, session=table(page("Excellence Technique")))
    row = PublicProbe.objects.get(url=PORTAIL)
    assert (row.ok, row.fails, row.last_ok_at) == (False, 1, None)


def test_summary_none_without_configuration(settings):
    settings.PROBES = ""
    assert probes.summary() is None


@pytest.mark.django_db
def test_overview_carries_probes(ops, configured):
    probes.collect(now=NOW, session=table(page("Excellence Technique")))
    body = ops.get("/api/v1/supervision/overview").json()["probes"]
    assert body["alerts"] == 0 and body["alert_after"] == 2 and body["timeout_s"] == 5
    assert [(i["url"], i["kind"], i["ok"], i["reason"]) for i in body["items"]] == [
        (PORTAIL, "title", True, ""), (ANCIEN, "redirect", True, "moved")]


@pytest.mark.django_db
def test_overview_probes_refused_without_role(trainer, configured):
    assert trainer.get("/api/v1/supervision/overview").status_code == 403
