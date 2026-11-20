"""Client Docker en lecture seule, derrière le proxy de socket.

Seules des requêtes GET partent d'ici ; le proxy (wollomatic/socket-proxy) refuse de
toute façon le reste. Pas d'`inspect` (/containers/<id>/json) : il expose l'Env de
chaque conteneur. Les journaux ne sont lus que pour le conteneur de la passerelle.
"""
from __future__ import annotations

import struct

import requests
from django.conf import settings

TIMEOUT_S = 10


class DockerError(RuntimeError):
    pass


def _get(path: str, params: dict | None = None, raw: bool = False):
    url = settings.DOCKER_PROXY_URL.rstrip("/") + path
    try:
        response = requests.get(url, params=params, timeout=TIMEOUT_S)
    except requests.RequestException as exc:
        raise DockerError(f"proxy Docker injoignable : {exc.__class__.__name__}") from exc
    if response.status_code != 200:
        raise DockerError(f"GET {path} : HTTP {response.status_code}")
    return response.content if raw else response.json()


def list_containers() -> list[dict]:
    return _get("/containers/json", {"all": "1"})


def edge_logs(since: int) -> list[str]:
    """Lignes de sortie standard de la passerelle depuis `since` (secondes UNIX)."""
    name = settings.SUPERVISION_EDGE_CONTAINER
    if not name:
        return []
    raw = _get(f"/containers/{name}/logs", {"stdout": "1", "stderr": "0", "since": str(since)}, raw=True)
    return demux(raw).decode("utf-8", errors="replace").splitlines()


def demux(raw: bytes) -> bytes:
    """Flux multiplexé Docker (en-tête de 8 octets par trame) -> texte brut.

    Un conteneur avec TTY envoie du texte brut : on le rend tel quel.
    """
    if not raw or raw[0] not in (0, 1, 2) or raw[1:4] != b"\x00\x00\x00":
        return raw
    out = bytearray()
    offset = 0
    while offset + 8 <= len(raw):
        stream, size = raw[offset], struct.unpack(">I", raw[offset + 4:offset + 8])[0]
        chunk = raw[offset + 8:offset + 8 + size]
        if stream == 1:
            out += chunk
        offset += 8 + size
    return bytes(out)
