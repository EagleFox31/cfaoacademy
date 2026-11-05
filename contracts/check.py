"""Contrôle du registre de contrats inter-modules (CI et poste local).

    python contracts/check.py [--base REF|auto|none] [--require-oasdiff]

Pour chaque contrat de `registry.json` :
1. la spec existe, son format est connu, sa version est semver, les plages des
   consommateurs l'acceptent ;
2. les Dockerfiles portent les labels attendus (`sync.py --check`) ;
3. si la spec a changé depuis le merge-base avec la branche de base : version
   haussée, et MAJOR haussée si l'outil du format détecte une rupture.

La branche de base est découverte (`GITHUB_BASE_REF`, puis `origin/HEAD`) ;
introuvable, l'étape 3 est sautée avec un avertissement. Code 0 si conforme.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import kit
import sync


def _git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=kit.ROOT, capture_output=True, text=True, encoding="utf-8")


def discover_base(environ: dict | None = None) -> str | None:
    environ = os.environ if environ is None else environ
    if environ.get("GITHUB_BASE_REF"):
        return f"origin/{environ['GITHUB_BASE_REF']}"
    head = _git("symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD")
    return head.stdout.strip() if head.returncode == 0 and head.stdout.strip() else None


def _base_spec(base: str, spec_path: str) -> dict | None:
    merge_base = _git("merge-base", base, "HEAD")
    if merge_base.returncode != 0:
        return None
    shown = _git("show", f"{merge_base.stdout.strip()}:{spec_path}")
    return json.loads(shown.stdout) if shown.returncode == 0 else None


def _oasdiff(base_spec: dict, head_path: Path) -> list[str] | None:
    """Ruptures selon oasdiff, ou None si oasdiff est absent."""
    binary = shutil.which("oasdiff")
    if not binary:
        return None
    with tempfile.TemporaryDirectory() as tmp:
        base_path = Path(tmp) / "base.json"
        base_path.write_text(json.dumps(base_spec), encoding="utf-8")
        result = subprocess.run(
            [binary, "breaking", str(base_path), str(head_path), "--fail-on", "ERR", "--format", "singleline"],
            capture_output=True, text=True, encoding="utf-8",
        )
    if result.returncode == 0:
        return []
    return [line for line in result.stdout.splitlines() if line.strip()] or [result.stderr.strip()]


# Détecteur de ruptures par format. Format sans détecteur : traité comme oasdiff absent.
BREAKING = {"openapi": _oasdiff}


def evolution_errors(cid: str, previous: dict | None, spec: dict, version_of, breaking, require_tool: bool) -> list[str]:
    """Règle semver entre la spec du merge-base et celle de HEAD.

    `breaking()` renvoie la liste des ruptures, ou None si l'outil est absent.
    Nouveau contrat ou spec inchangée : rien à vérifier.
    """
    if previous is None or previous == spec:
        return []
    old, new = version_of(previous), version_of(spec)
    try:
        before, head = kit.parse_version(old), kit.parse_version(new)
    except ValueError as exc:
        return [f"{cid} : {exc}"]
    if head <= before:
        return [f"{cid} : spec modifiée sans hausse de version ({old} -> {new})"]
    found = breaking()
    if found is None:
        message = f"{cid} : outil de détection des ruptures absent, ruptures non vérifiées"
        if require_tool:
            return [message]
        print(f"avertissement {message}", file=sys.stderr)
        return []
    if found and head[0] == before[0]:
        return [f"{cid} : rupture sans hausse de MAJOR ({old} -> {new})", *(f"  {line}" for line in found)]
    return []


def check(base: str | None, require_tool: bool) -> list[str]:
    registry = kit.load_registry()
    errors: list[str] = []

    for entry in registry["contracts"]:
        cid = entry["id"]
        spec_format = entry.get("format", "openapi")
        if spec_format not in kit.FORMATS:
            errors.append(f"{cid} : format inconnu {spec_format!r}")
            continue
        spec_path = kit.ROOT / entry["spec"]
        if not spec_path.is_file():
            errors.append(f"{cid} : spec introuvable {entry['spec']}")
            continue
        if entry["provider"] not in registry["modules"]:
            errors.append(f"{cid} : fournisseur {entry['provider']} absent de modules")
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
        version = kit.spec_version(entry, spec)
        try:
            kit.parse_version(version)
        except ValueError as exc:
            errors.append(f"{cid} : {exc}")
            continue
        for consumer in entry["consumers"]:
            if consumer["module"] not in registry["modules"]:
                errors.append(f"{cid} : consommateur {consumer['module']} absent de modules")
            if not kit.satisfies(version, consumer["range"]):
                errors.append(f"{cid} {version} : refusé par {consumer['module']} ({consumer['range']})")
            for path in consumer.get("client_files", []) + consumer.get("tests", []):
                if not (kit.ROOT / path).is_file():
                    errors.append(f"{cid} : fichier consommateur introuvable {path}")

        if base is not None:
            previous = _base_spec(base, entry["spec"])
            detector = BREAKING.get(spec_format, lambda *_: None)
            errors.extend(evolution_errors(
                cid, previous, spec,
                lambda document: kit.FORMATS[spec_format](document),
                lambda: detector(previous, spec_path),
                require_tool,
            ))

    drifted, conflicts = sync.sync(write=False)
    errors += [f"conflit : {item}" for item in conflicts]
    errors += [f"labels en dérive : {path.relative_to(kit.ROOT).as_posix()} (lancer contracts/sync.py)" for path in drifted]
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base", default="auto", help="référence de comparaison ; auto (défaut) ou none")
    parser.add_argument("--require-oasdiff", action="store_true", help="échec si l'outil de rupture manque")
    args = parser.parse_args(argv)
    base = {"auto": discover_base(), "none": None}.get(args.base, args.base)
    if base is None and args.base == "auto":
        print("avertissement : branche de base introuvable, évolution non vérifiée", file=sys.stderr)
    errors = check(base, args.require_oasdiff)
    for error in errors:
        print(error)
    print("contrats : conformes" if not errors else f"contrats : {len(errors)} écart(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
