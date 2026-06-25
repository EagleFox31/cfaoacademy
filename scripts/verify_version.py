#!/usr/bin/env python3
"""Vérifie l'alignement VERSION / package.json / tag git optionnel."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = ("frontend/package.json", "cfao-operations/package.json")


def main() -> None:
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    if not version:
        raise SystemExit("VERSION est vide")

    tag = sys.argv[1] if len(sys.argv) > 1 else None
    if tag:
        if tag.startswith("v"):
            tag = tag[1:]
        if tag != version:
            raise SystemExit(f"Tag v{tag} != VERSION ({version})")

    for rel in PACKAGES:
        path = ROOT / rel
        pkg_version = json.loads(path.read_text(encoding="utf-8"))["version"]
        if pkg_version != version:
            raise SystemExit(f"{rel}: {pkg_version} != VERSION ({version})")

    print(f"Version alignée : {version}")


if __name__ == "__main__":
    main()
