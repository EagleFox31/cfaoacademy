"""Contrôle du registre de contrats inter-modules (CI et poste local).

    python contracts/check.py [--base REF] [--require-oasdiff]

Pour chaque contrat de `registry.json` :
1. la spec existe, sa version est semver, les plages des consommateurs l'acceptent ;
2. les Dockerfiles des modules portent les labels `org.cfao.*` attendus ;
3. si la spec a changé depuis le merge-base avec REF (défaut origin/main) :
   version haussée, et MAJOR haussée si oasdiff détecte une rupture.

Code de sortie 0 si tout est conforme, 1 sinon. Aucun accès réseau.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import kit


def _git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=kit.ROOT, capture_output=True, text=True, encoding="utf-8")


def _base_spec(base: str, spec_path: str) -> dict | None:
    merge_base = _git("merge-base", base, "HEAD")
    if merge_base.returncode != 0:
        return None
    shown = _git("show", f"{merge_base.stdout.strip()}:{spec_path}")
    return json.loads(shown.stdout) if shown.returncode == 0 else None


def _breaking(base_spec: dict, head_path: Path) -> list[str] | None:
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


def evolution_errors(cid: str, previous: dict | None, spec: dict, breaking, require_oasdiff: bool) -> list[str]:
    """Règle semver entre la spec du merge-base et celle de HEAD.

    `breaking()` renvoie la liste des ruptures, ou None si l'outil est absent.
    Nouveau contrat ou spec inchangée : rien à vérifier.
    """
    if previous is None or previous == spec:
        return []
    old, new = previous["info"]["version"], spec["info"]["version"]
    try:
        before, head = kit.parse_version(old), kit.parse_version(new)
    except ValueError as exc:
        return [f"{cid} : {exc}"]
    if head <= before:
        return [f"{cid} : spec modifiée sans hausse de version ({old} -> {new})"]
    found = breaking()
    if found is None:
        message = f"{cid} : oasdiff absent, ruptures non vérifiées"
        if require_oasdiff:
            return [message]
        print(f"avertissement {message}", file=sys.stderr)
        return []
    if found and head[0] == before[0]:
        return [f"{cid} : rupture sans hausse de MAJOR ({old} -> {new})", *(f"  {line}" for line in found)]
    return []


def check(base: str | None, require_oasdiff: bool) -> list[str]:
    registry = kit.load_registry()
    errors: list[str] = []

    for entry in registry["contracts"]:
        cid = entry["id"]
        spec_path = kit.ROOT / entry["spec"]
        if not spec_path.is_file():
            errors.append(f"{cid} : spec introuvable {entry['spec']}")
            continue
        if entry["provider"] not in registry["modules"]:
            errors.append(f"{cid} : fournisseur {entry['provider']} absent de modules")
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
        version = spec["info"]["version"]
        try:
            head = kit.parse_version(version)
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
            errors.extend(evolution_errors(cid, previous, spec, lambda: _breaking(previous, spec_path), require_oasdiff))

    for module, labels in kit.expected_labels(registry).items():
        dockerfile = kit.ROOT / registry["modules"][module]["dockerfile"]
        found = kit.dockerfile_labels(dockerfile)
        for key, value in labels.items():
            if found.get(key, "") != value:
                errors.append(f"{module} : {dockerfile.relative_to(kit.ROOT).as_posix()} doit porter {key}=\"{value}\"")
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base", default="origin/main", help="référence de comparaison ; « none » pour l'ignorer")
    parser.add_argument("--require-oasdiff", action="store_true")
    args = parser.parse_args(argv)
    errors = check(None if args.base == "none" else args.base, args.require_oasdiff)
    for error in errors:
        print(error)
    print("contrats : conformes" if not errors else f"contrats : {len(errors)} écart(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
