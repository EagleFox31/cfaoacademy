"""Lecture des labels de contrat (org.cfao.contracts.*).

Mêmes règles que contracts/kit.py (satisfies, parse_label), recopiées ici parce que
l'image de l'API ne contient pas le dossier contracts/ ; un test garde les deux
alignés sur les mêmes exemples.
"""
from __future__ import annotations

import re

_SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
_RANGE = re.compile(r"^\^(\d+)(?:\.(\d+))?(?:\.(\d+))?$")


def parse_label(value: str | None) -> dict[str, str]:
    """`a@1.0.0,b@^2` -> {"a": "1.0.0", "b": "^2"}."""
    pairs: dict[str, str] = {}
    for item in (value or "").split(","):
        item = item.strip()
        if item:
            name, _, version = item.partition("@")
            pairs[name] = version
    return pairs


def satisfies(version: str, version_range: str) -> bool | None:
    """`^1` accepte 1.x.y ; `^1.2` accepte 1.y.z avec y >= 2 ; sinon égalité stricte.
    None si une version n'est pas lisible."""
    current = _SEMVER.match(version or "")
    if not current:
        return None
    current_t = tuple(int(part) for part in current.groups())
    match = _RANGE.match(version_range or "")
    if not match:
        exact = _SEMVER.match(version_range or "")
        return None if not exact else current_t == tuple(int(part) for part in exact.groups())
    floor = tuple(int(part or 0) for part in match.groups())
    return current_t[0] == floor[0] and current_t >= floor
