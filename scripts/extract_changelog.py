#!/usr/bin/env python3
"""Extrait la section CHANGELOG.md pour une version SemVer (sans préfixe v).

Par défaut le CHANGELOG.md racine (release.yml) ; un second argument désigne celui
d'un module (scripts/build_image.py).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHANGELOG = ROOT / "CHANGELOG.md"


def extract(version: str, changelog: Path = CHANGELOG) -> str:
    text = Path(changelog).read_text(encoding="utf-8")
    pattern = (
        rf"## \[{re.escape(version)}\][^\n]*\n"
        r"(.*?)"
        r"(?=\n## \[|\Z)"
    )
    match = re.search(pattern, text, re.DOTALL)
    if not match:
        raise SystemExit(f"Aucune section ## [{version}] dans {changelog}")
    return match.group(1).strip()


def main() -> None:
    if len(sys.argv) not in (2, 3):
        raise SystemExit(f"Usage: {sys.argv[0]} <version> [CHANGELOG.md]  (ex. 0.1.0)")
    sys.stdout.write(extract(*sys.argv[1:2], *[Path(p) for p in sys.argv[2:3]]))


if __name__ == "__main__":
    main()
