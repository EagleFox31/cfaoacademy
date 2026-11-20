"""Connexions refusées par le pare-feu du serveur (journal ufw).

Le journal est lu en lecture seule, par morceaux, depuis la dernière position
retenue (`inode:octet` dans CollectRun). Rotation (fichier renommé en `.1`) : la
fin de l'ancien fichier est lue avant de reprendre le nouveau depuis le début.
Fichier tronqué : reprise au début. Les compteurs et la position sont écrits dans
la même transaction : rejouer une passe n'ajoute rien.
"""
from __future__ import annotations

import ipaddress
import os
import re
from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.db import transaction
from django.utils import timezone as djtz

from ..models import CollectRun, RefusedAttempt

SOURCE = "firewall"
BUCKET_S = 300
MAX_BYTES = 5 * 1024 * 1024  # par passe ; le reste à la passe suivante

LINE = re.compile(r"^(?P<ts>\S+)\s+\S+\s+kernel:.*?\[UFW (?:LIMIT )?BLOCK\](?P<fields>.*)$")
FIELD = re.compile(r"\b([A-Z]+)=(\S*)")


# ── Lecture du journal ──

def _parse_cursor(cursor: str) -> tuple[int | None, int]:
    inode, _, offset = cursor.partition(":")
    if inode.isdigit() and offset.isdigit():
        return int(inode), int(offset)
    return None, 0


def _read_from(path: str, offset: int, budget: int) -> tuple[list[str], int]:
    """Lignes complètes à partir de `offset` ; renvoie la nouvelle position."""
    with open(path, "rb") as handle:
        handle.seek(offset)
        chunk = handle.read(budget)
    end = chunk.rfind(b"\n")
    if end < 0:
        return [], offset
    chunk = chunk[:end + 1]
    return chunk.decode("utf-8", errors="replace").splitlines(), offset + len(chunk)


def read_new_lines(path: str, cursor: str) -> tuple[list[str], str]:
    """(nouvelles lignes, nouveau curseur). Journal absent : rien, curseur inchangé."""
    try:
        current = os.stat(path)
    except FileNotFoundError:
        return [], cursor
    inode, offset = _parse_cursor(cursor)
    lines: list[str] = []
    budget = MAX_BYTES
    if inode is not None and inode != current.st_ino:
        rotated = f"{path}.1"
        try:
            old = os.stat(rotated)
        except FileNotFoundError:
            old = None
        if old is not None and old.st_ino == inode and offset < old.st_size:
            lines, reached = _read_from(rotated, offset, budget)
            if reached < old.st_size and lines:  # ancien fichier pas fini : suite au prochain passage
                return lines, f"{inode}:{reached}"
            budget -= reached - offset
        offset = 0
    elif offset > current.st_size:
        offset = 0
    fresh, offset = _read_from(path, offset, max(budget, 1))
    return lines + fresh, f"{current.st_ino}:{offset}"


# ── Analyse d'une ligne ──

def parse_line(line: str):
    """(date, ip source, port visé, protocole) pour un refus, sinon None."""
    match = LINE.match(line.strip())
    if not match:
        return None
    try:
        at = datetime.fromisoformat(match["ts"])
    except ValueError:
        return None
    if at.tzinfo is None:
        at = at.replace(tzinfo=timezone.utc)
    fields = dict(FIELD.findall(match["fields"]))
    try:
        src = ipaddress.ip_address(fields.get("SRC", ""))
        dst = ipaddress.ip_address(fields.get("DST", ""))
    except ValueError:
        return None
    # Diffusion et multidiffusion : bruit du réseau, pas un poste qui tente sa chance.
    if dst.is_multicast or str(dst) == "255.255.255.255":
        return None
    port = fields.get("DPT", "")
    return at, str(src), int(port) if port.isdigit() else None, fields.get("PROTO", "")[:10]


def _bucket(at: datetime) -> datetime:
    start = int(at.timestamp()) // BUCKET_S * BUCKET_S
    return datetime.fromtimestamp(start, tz=timezone.utc)


# ── Collecte ──

def collect(now=None) -> dict:
    now = now or djtz.now()
    oldest = now - timedelta(days=settings.REFUSED_RETENTION_DAYS)
    run, _ = CollectRun.objects.get_or_create(source=SOURCE)
    lines, cursor = read_new_lines(settings.UFW_LOG_PATH, run.cursor)
    groups: dict[tuple, list] = {}
    for line in lines:
        parsed = parse_line(line)
        if not parsed or parsed[0] < oldest:
            continue
        at, src, port, proto = parsed
        key = (src, port, proto, _bucket(at))
        group = groups.setdefault(key, [0, at, at])
        group[0] += 1
        group[1] = min(group[1], at)
        group[2] = max(group[2], at)
    with transaction.atomic():
        for (src, port, proto, bucket), (count, first, last) in groups.items():
            row, created = RefusedAttempt.objects.select_for_update().get_or_create(
                src_ip=src, dst_port=port, proto=proto, bucket=bucket,
                defaults={"count": count, "first_at": first, "last_at": last})
            if not created:
                row.count += count
                row.first_at = min(row.first_at, first)
                row.last_at = max(row.last_at, last)
                row.save(update_fields=["count", "first_at", "last_at"])
        run.cursor = cursor
        run.save(update_fields=["cursor"])
    return {"lines": len(lines), "refused": sum(g[0] for g in groups.values())}


def purge(now=None) -> int:
    now = now or djtz.now()
    limit = now - timedelta(days=settings.REFUSED_RETENTION_DAYS)
    return RefusedAttempt.objects.filter(bucket__lt=limit).delete()[0]


# ── Lecture pour l'écran ──

def network_of(ip: str) -> str:
    address = ipaddress.ip_address(ip)
    prefix = 24 if address.version == 4 else 64
    return str(ipaddress.ip_network(f"{ip}/{prefix}", strict=False))


def summary(now=None, hours: int = 24) -> dict:
    """Refus des `hours` dernières heures, regroupés par /24 puis par poste."""
    now = now or djtz.now()
    since = now - timedelta(hours=hours)
    recent_since = now - timedelta(minutes=settings.REFUSED_ALERT_WINDOW_MIN)
    threshold = settings.REFUSED_ALERT_THRESHOLD
    ips: dict[str, dict] = {}
    for row in RefusedAttempt.objects.filter(last_at__gte=since):
        entry = ips.setdefault(row.src_ip, {"ip": row.src_ip, "total": 0, "recent": 0, "ports": set(),
                                            "first_at": row.first_at, "last_at": row.last_at})
        entry["total"] += row.count
        if row.last_at >= recent_since:  # à la tranche de 5 min près
            entry["recent"] += row.count
        if row.dst_port is not None:
            entry["ports"].add(row.dst_port)
        entry["first_at"] = min(entry["first_at"], row.first_at)
        entry["last_at"] = max(entry["last_at"], row.last_at)
    networks: dict[str, dict] = {}
    for entry in ips.values():
        entry["alert"] = entry["recent"] >= threshold
        net = networks.setdefault(network_of(entry["ip"]), {"network": network_of(entry["ip"]), "total": 0,
                                                             "recent": 0, "last_at": entry["last_at"], "ips": []})
        net["total"] += entry["total"]
        net["recent"] += entry["recent"]
        net["last_at"] = max(net["last_at"], entry["last_at"])
        net["ips"].append(entry)

    def rank(item):
        return (not item["alert"], -item["recent"], -item["total"], -item["last_at"].timestamp())

    result = []
    for net in networks.values():
        net["alert"] = net["recent"] >= threshold
        net["addresses"] = len(net["ips"])
        net["ips"] = [{**ip, "ports": sorted(ip["ports"]), "first_at": ip["first_at"].isoformat(),
                       "last_at": ip["last_at"].isoformat()} for ip in sorted(net["ips"], key=rank)]
        result.append(net)
    result.sort(key=rank)
    for net in result:
        net["last_at"] = net["last_at"].isoformat()
    return {
        "hours": hours,
        "window_min": settings.REFUSED_ALERT_WINDOW_MIN,
        "threshold": threshold,
        "retention_days": settings.REFUSED_RETENTION_DAYS,
        "alerts": sum(1 for net in result for ip in net["ips"] if ip["alert"]),
        "total": sum(net["total"] for net in result),
        "networks": result,
    }
