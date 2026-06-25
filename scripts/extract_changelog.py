#!/usr/bin/env python3
"""Extrait la section CHANGELOG.md pour une version SemVer (sans préfixe v)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHANGELOG = ROOT / "CHANGELOG.md"


def extract(version: str) -> str:
    text = CHANGELOG.read_text(encoding="utf-8")
    pattern = (
        rf"## \[{re.escape(version)}\][^\n]*\n"
        r"(.*?)"
        r"(?=\n## \[|\Z)"
    )
    match = re.search(pattern, text, re.DOTALL)
    if not match:
        raise SystemExit(f"Aucune section ## [{version}] dans CHANGELOG.md")
    return match.group(1).strip()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(f"Usage: {sys.argv[0]} <version>  (ex. 0.1.0)")
    sys.stdout.write(extract(sys.argv[1]))


if __name__ == "__main__":
    main()
