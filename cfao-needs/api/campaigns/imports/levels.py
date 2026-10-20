"""Niveaux constructeur du catalogue, indexés par code formation.

Le fichier de travail 2027 ne porte que JUNIOR / SENIOR / EXPERT (paliers
MEDACAP). La vitrine, elle, groupe les formations dans la nomenclature de
chaque marque : G4→G1 (Toyota), Bronze→Gold (Suzuki), BASIC (Mercedes)…

Cette table rapproche les deux : l'écran de saisie affiche le niveau que le
technicien de filiale reconnaît, pas seulement le palier générique.

Régénération : `node cfao-needs/scripts/build-levels.mjs`.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parents[2] / "referential" / "data" / "levels_by_code.json"

_SEPARATORS = re.compile(r"[\s&_]")
_HYPHENS = re.compile(r"-+")
_SUZUKI = re.compile(r"^(.+)-(BRONZE|SILVER|GOLD)$", re.I)
_TOYOTA_G = re.compile(r"^(.+)-(G[1-4])$", re.I)


def normalize_code(code: str | None) -> str:
    if not code:
        return ""
    return _HYPHENS.sub("-", _SEPARATORS.sub("", str(code).upper())).strip()


def _fiche_code(code: str) -> str:
    """Retire le suffixe de certification planning (SS05-SILVER → SS05)."""
    key = normalize_code(code)
    match = _SUZUKI.match(key)
    return match.group(1) if match else key


@lru_cache(maxsize=1)
def levels() -> dict[str, str]:
    if not DATA_FILE.exists():
        return {}
    payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    return {
        normalize_code(code): label
        for code, label in payload.get("levels", {}).items()
    }


def level_label(code: str | None, *, tier: str = "") -> str:
    """Libellé constructeur pour un code, avec repli sur le palier MEDACAP."""
    key = normalize_code(code)
    if not key:
        return ""
    table = levels()
    found = table.get(key) or table.get(_fiche_code(code))
    if found:
        return found

    suzuki = _SUZUKI.match(key)
    if suzuki:
        return suzuki.group(2).capitalize()
    toyota = _TOYOTA_G.match(key)
    if toyota:
        return toyota.group(2).upper()

    if tier and tier.upper() in {"JUNIOR", "SENIOR", "EXPERT"}:
        return tier.capitalize()
    return ""
