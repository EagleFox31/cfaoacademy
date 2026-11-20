"""Postes qui n'arrivent pas au bout de la connexion, vus par Caddy (journal copié par rsyslog).

Deux signaux, lus dans le même journal que le reste (lecture incrémentale de firewall) :
- poignée TLS ratée (logger `http.stdlib`, niveau DEBUG) : le navigateur refuse le
  certificat (« remote error: tls: … certificate … ») ou la poignée échoue autrement.
  Une connexion fermée sans un mot (EOF, délai) est du bruit : préconnexions des
  navigateurs, balayages ; elle est ignorée. Le message ne dit pas le port visé.
- journal d'accès (logger `http.log.access…`, sans chemin ni en-têtes) : une
  redirection (3xx, ex. 8092 → 8445) suivie d'aucune autre réponse = le poste s'est
  arrêté en route.

Minimisation : une arrivée n'est retenue que pour un poste déjà suspect (poignée
ratée ou redirection dans la période de rétention), pas pour tous les postes.
"""
from __future__ import annotations

import ipaddress
import json
from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.db import transaction
from django.utils import timezone as djtz

from ..models import CollectRun, EntryEvent
from .firewall import _bucket, network_of, read_new_lines

SOURCE = "caddy"
HANDSHAKE = "TLS handshake error from "
# Fermetures muettes : rien à dire du poste.
SILENT = ("EOF", "i/o timeout", "connection reset by peer", "broken pipe")


def _address(text: str) -> str | None:
    """IP d'un « ip:port », « [ipv6]:port » ou d'une IP nue."""
    text = text.strip()
    if text.startswith("["):
        host = text[1:].split("]")[0]
    elif text.count(":") == 1:
        host = text.split(":")[0]
    else:
        host = text
    try:
        return str(ipaddress.ip_address(host))
    except ValueError:
        return None


def _port_of(host: str) -> int | None:
    _, sep, port = host.rpartition(":")
    return int(port) if sep and port.isdigit() else None


def classify_handshake(error: str) -> str | None:
    if any(error.endswith(silent) for silent in SILENT):
        return None
    if error.startswith("remote error: tls:") and "certificate" in error:
        return "cert_refused"
    return "tls_failed"


def parse_line(line: str):
    """(date, ip du poste, port, genre) ou None. La ligne est celle de rsyslog :
    « <date> <hôte> caddy[pid]: {json} »."""
    start = line.find("{")
    if start < 0:
        return None
    try:
        entry = json.loads(line[start:])
        at = datetime.fromtimestamp(float(entry["ts"]), tz=timezone.utc)
    except (ValueError, KeyError, TypeError):
        return None
    logger = entry.get("logger", "")
    if logger == "http.stdlib":
        message = entry.get("msg", "")
        if HANDSHAKE not in message:
            return None
        remote, _, error = message.split(HANDSHAKE, 1)[1].partition(": ")
        kind = classify_handshake(error.strip())
        ip = _address(remote)
        return (at, ip, None, kind) if kind and ip else None
    if logger.startswith("http.log.access"):
        request = entry.get("request") or {}
        ip = _address(request.get("remote_ip", ""))
        status = entry.get("status")
        if not ip or not isinstance(status, int):
            return None
        kind = "redirected" if 300 <= status < 400 else "arrived"
        return at, ip, _port_of(request.get("host", "")), kind
    return None


# ── Collecte ──

def collect(now=None) -> dict:
    now = now or djtz.now()
    oldest = now - timedelta(days=settings.REFUSED_RETENTION_DAYS)
    run, _ = CollectRun.objects.get_or_create(source=SOURCE)
    lines, cursor = read_new_lines(settings.CADDY_LOG_PATH, run.cursor)
    parsed = [p for p in map(parse_line, lines) if p and p[0] >= oldest]
    suspects = {ip for _, ip, _, kind in parsed if kind != "arrived"}
    suspects |= set(EntryEvent.objects.filter(bucket__gte=oldest).exclude(kind="arrived")
                    .values_list("src_ip", flat=True))
    groups: dict[tuple, list] = {}
    for at, ip, port, kind in parsed:
        if kind == "arrived" and ip not in suspects:
            continue
        group = groups.setdefault((ip, port, kind, _bucket(at)), [0, at, at])
        group[0] += 1
        group[1] = min(group[1], at)
        group[2] = max(group[2], at)
    with transaction.atomic():
        for (ip, port, kind, bucket), (count, first, last) in groups.items():
            row, created = EntryEvent.objects.select_for_update().get_or_create(
                src_ip=ip, port=port, kind=kind, bucket=bucket,
                defaults={"count": count, "first_at": first, "last_at": last})
            if not created:
                row.count += count
                row.first_at = min(row.first_at, first)
                row.last_at = max(row.last_at, last)
                row.save(update_fields=["count", "first_at", "last_at"])
        run.cursor = cursor
        run.save(update_fields=["cursor"])
    kept = sum(g[0] for g in groups.values())
    return {"lines": len(lines), "kept": kept}


def purge(now=None) -> int:
    now = now or djtz.now()
    limit = now - timedelta(days=settings.REFUSED_RETENTION_DAYS)
    return EntryEvent.objects.filter(bucket__lt=limit).delete()[0]


# ── Lecture pour l'écran ──

def summary(now=None, hours: int = 24) -> dict:
    """Postes en difficulté sur les `hours` dernières heures (arrivés ensuite ou non)."""
    now = now or djtz.now()
    since = now - timedelta(hours=hours)
    window_since = now - timedelta(minutes=settings.REFUSED_ALERT_WINDOW_MIN)
    grace = timedelta(seconds=settings.REDIRECT_GRACE_S)
    ips: dict[str, dict] = {}
    for row in EntryEvent.objects.filter(last_at__gte=since):
        entry = ips.setdefault(row.src_ip, {"ip": row.src_ip, "cert_refused": 0, "tls_failed": 0,
                                            "redirected": 0, "recent_failures": 0, "ports": set(),
                                            "last_failure_at": None, "last_redirect_at": None,
                                            "last_arrival_at": None})
        if row.kind in ("cert_refused", "tls_failed"):
            entry[row.kind] += row.count
            if row.last_at >= window_since:
                entry["recent_failures"] += row.count
            entry["last_failure_at"] = max(filter(None, (entry["last_failure_at"], row.last_at)))
        elif row.kind == "redirected":
            entry["redirected"] += row.count
            entry["last_redirect_at"] = max(filter(None, (entry["last_redirect_at"], row.last_at)))
        else:
            entry["last_arrival_at"] = max(filter(None, (entry["last_arrival_at"], row.last_at)))
        if row.port is not None and row.kind != "arrived":
            entry["ports"].add(row.port)
    result = []
    for entry in ips.values():
        arrival = entry["last_arrival_at"]
        failure, redirect = entry["last_failure_at"], entry["last_redirect_at"]
        # Bloqué au certificat : refus répétés sur la fenêtre, et pas arrivé depuis.
        cert_stuck = (entry["recent_failures"] >= settings.CERT_ALERT_THRESHOLD
                      and failure is not None and (arrival is None or arrival < failure))
        # Arrêté en route : redirigé, puis plus rien passé le délai de grâce.
        lost = (redirect is not None and redirect <= now - grace
                and (arrival is None or arrival < redirect))
        if not (failure or lost):  # redirigé puis arrivé : rien à montrer
            continue
        entry.update({
            "network": network_of(entry["ip"]),
            "stuck_on_certificate": cert_stuck,
            "lost_after_redirect": lost,
            "alert": cert_stuck or lost,
            "ports": sorted(entry["ports"]),
            "arrived": arrival is not None and arrival >= max(filter(None, (failure, redirect))),
        })
        for key in ("last_failure_at", "last_redirect_at", "last_arrival_at"):
            entry[key] = entry[key].isoformat() if entry[key] else None
        result.append(entry)
    result.sort(key=lambda e: (not e["alert"], -e["recent_failures"], -(e["cert_refused"] + e["tls_failed"])))
    return {
        "hours": hours,
        "threshold": settings.CERT_ALERT_THRESHOLD,
        "grace_s": settings.REDIRECT_GRACE_S,
        "alerts": sum(1 for e in result if e["alert"]),
        "postes": result,
    }
