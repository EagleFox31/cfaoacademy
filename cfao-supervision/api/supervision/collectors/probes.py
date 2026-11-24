"""Sondes des adresses publiques, faites depuis le serveur (conteneur collecteur).

Une sonde réussit sur le CONTENU, jamais sur un code 200 seul (une page de repli
de la SPA répond 200 partout) :
- `url|fragment du titre` : réponse 200 dont le <title> contient le fragment ;
- `url|-> adresse` : redirection (301, 302, 303, 307, 308) vers exactement cette adresse.
Les redirections ne sont jamais suivies : chaque saut se sonde à part.

Configuration : SUPERVISION_PROBES, entrées séparées par « ; » ou un saut de ligne.
Vide = source désactivée (l'écran n'affiche pas le bloc).

TLS non vérifié : les adresses sont des IP du réseau local servies par Caddy avec
sa propre autorité. Rien n'est envoyé (ni jeton, ni cookie) ; un échec de
négociation TLS reste détecté et affiché.
"""
from __future__ import annotations

import html
import re
import ssl
import time
import warnings
from dataclasses import dataclass
from urllib.parse import urlsplit

import requests
import urllib3
from django.conf import settings
from django.db import transaction
from django.utils import timezone as djtz

from ..models import PublicProbe

SOURCE = "probes"
REDIRECTS = {301, 302, 303, 307, 308}
MAX_BODY = 64 * 1024
TITLE = re.compile(rb"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
DETAIL_MAX = 200


@dataclass(frozen=True)
class Probe:
    url: str
    expected: str
    redirect: bool


def parse_config(raw: str) -> list[Probe]:
    """Liste des sondes ; ValueError si une entrée est mal écrite (affichée à l'écran)."""
    probes: list[Probe] = []
    seen: set[str] = set()
    for entry in re.split(r"[;\n]", raw or ""):
        entry = entry.strip()
        if not entry:
            continue
        url, sep, expected = entry.partition("|")
        url, expected = url.strip(), expected.strip()
        redirect = expected.startswith("->")
        if redirect:
            expected = expected[2:].strip()
        parts = urlsplit(url)
        if not sep or not expected or parts.scheme not in ("http", "https") or not parts.netloc:
            raise ValueError(f"sonde mal écrite : {entry[:80]!r} (attendu « url|titre » ou « url|-> adresse »)")
        if url in seen:
            raise ValueError(f"sonde en double : {url}")
        seen.add(url)
        probes.append(Probe(url, expected, redirect))
    return probes


def configured() -> list[Probe]:
    return parse_config(settings.PROBES)


def _clean(text: str) -> str:
    return " ".join(text.split())[:DETAIL_MAX]


def read_title(body: bytes) -> str | None:
    match = TITLE.search(body)
    if not match:
        return None
    return _clean(html.unescape(match.group(1).decode("utf-8", errors="replace")))


def failure_reason(exc: BaseException) -> str:
    """Motif d'un échec réseau, traduit par l'écran ; l'ordre compte (SSLError est
    une ConnectionError, ConnectTimeout aussi)."""
    if isinstance(exc, (requests.exceptions.SSLError, urllib3.exceptions.SSLError, ssl.SSLError)):
        return "tls"
    if isinstance(exc, (requests.exceptions.Timeout, urllib3.exceptions.TimeoutError, TimeoutError)):
        return "timeout"
    if isinstance(exc, (requests.exceptions.ConnectionError, urllib3.exceptions.ProtocolError)):
        return "connection"
    # Toute exception de requests est aussi un OSError : seul un OSError « nu » est réseau.
    if isinstance(exc, OSError) and not isinstance(exc, requests.RequestException):
        return "connection"
    return "error"


def check(probe: Probe, session: requests.Session) -> dict:
    """{ok, status_code, reason, detail, latency_ms} ; ne lève jamais.

    `reason` (traduit par l'écran) : "" = `detail` est le titre lu ; "moved" =
    `detail` est l'adresse de redirection ; "http", "no_title", "tls", "timeout",
    "connection", "error". Sur une erreur réseau, `detail` garde la classe de
    l'exception pour le diagnostic.
    """
    started = time.monotonic()
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")  # InsecureRequestWarning : voir l'en-tête du module
            response = session.get(probe.url, allow_redirects=False, stream=True, verify=False,
                                   timeout=settings.PROBE_TIMEOUT_S, headers={"User-Agent": "cfao-supervision-sonde"})
            with response:
                body = response.raw.read(MAX_BODY, decode_content=True) if not probe.redirect else b""
    # La lecture du corps (urllib3) lève ses propres exceptions, hors de requests.
    except (requests.RequestException, urllib3.exceptions.HTTPError, OSError) as exc:
        return {"ok": False, "status_code": None, "latency_ms": int((time.monotonic() - started) * 1000),
                "reason": failure_reason(exc), "detail": _clean(exc.__class__.__name__)}
    latency = int((time.monotonic() - started) * 1000)
    status = response.status_code
    location = _clean(response.headers.get("Location", ""))
    if probe.redirect:
        ok = status in REDIRECTS and location == probe.expected
        return {"ok": ok, "status_code": status, "latency_ms": latency,
                "reason": "moved" if location else "http", "detail": location}
    title = read_title(body) if status == 200 else None
    ok = title is not None and probe.expected.casefold() in title.casefold()
    if status in REDIRECTS:
        reason, detail = "moved", location
    elif title is None:
        reason, detail = ("http" if status != 200 else "no_title"), ""
    else:
        reason, detail = "", title
    return {"ok": ok, "status_code": status, "latency_ms": latency, "reason": reason, "detail": detail}


def collect(now=None, session: requests.Session | None = None) -> dict:
    now = now or djtz.now()
    probes = configured()
    if session is None:
        session = requests.Session()
        session.trust_env = False  # pas de mandataire de l'environnement : on sonde le chemin direct
    results = [(position, probe, check(probe, session)) for position, probe in enumerate(probes)]
    with transaction.atomic():
        PublicProbe.objects.exclude(url__in=[p.url for p in probes]).delete()
        for position, probe, result in results:
            row = PublicProbe.objects.select_for_update().filter(url=probe.url).first() or PublicProbe(url=probe.url)
            changed = row.pk is None or row.expected != probe.expected or row.redirect != probe.redirect
            row.position = position
            row.expected = probe.expected
            row.redirect = probe.redirect
            row.ok = result["ok"]
            row.status_code = result["status_code"]
            row.reason = result["reason"]
            row.detail = result["detail"]
            row.latency_ms = result["latency_ms"]
            row.checked_at = now
            if result["ok"]:
                row.fails = 0
                row.last_ok_at = now
            else:
                row.fails = 1 if changed else row.fails + 1
                if changed:
                    row.last_ok_at = None
            row.save()
    return {"probes": len(results), "failing": sum(1 for _, _, r in results if not r["ok"])}


def summary() -> dict | None:
    """Pour la vue d'ensemble ; None si aucune sonde n'est configurée."""
    if not settings.PROBES.strip():
        return None
    threshold = settings.PROBE_ALERT_AFTER
    items = [{
        "url": row.url,
        "expected": row.expected,
        "kind": "redirect" if row.redirect else "title",
        "ok": row.ok,
        "status_code": row.status_code,
        "reason": row.reason,
        "detail": row.detail,
        "latency_ms": row.latency_ms,
        "checked_at": row.checked_at.isoformat() if row.checked_at else None,
        "last_ok_at": row.last_ok_at.isoformat() if row.last_ok_at else None,
        "fails": row.fails,
        "alert": row.fails >= threshold,
    } for row in PublicProbe.objects.order_by("position", "url")]
    return {"alert_after": threshold, "timeout_s": settings.PROBE_TIMEOUT_S, "alerts": sum(1 for i in items if i["alert"]), "items": items}
