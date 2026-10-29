"""Puis-je déployer cette image sans casser les modules en service ?

    python contracts/can_i_deploy.py IMAGE[:TAG] [--ssh cfao-serveur] [--allow-missing]

Lit les labels `org.cfao.*` de l'image candidate (`docker image inspect`, en
local) et ceux des conteneurs en service (`docker inspect`, en local ou par
SSH, lecture seule). Vérifie les deux sens :
- chaque contrat consommé par l'image est fourni, en version compatible, par
  un module en service ;
- chaque module en service qui consomme un contrat fourni par l'image accepte
  sa version.
Les conteneurs du même module que l'image sont ignorés : ils seront remplacés.
Code de sortie 0 si compatible, 1 sinon.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys

import kit


def _docker(args: list[str], ssh: str | None) -> str:
    command = ["docker", *args]
    if ssh:
        command = ["ssh", ssh, " ".join(command)]
    return subprocess.run(command, capture_output=True, text=True, encoding="utf-8", check=True).stdout


def image_labels(image: str) -> dict[str, str]:
    return json.loads(_docker(["image", "inspect", "--format", "'{{json .Config.Labels}}'", image], None).strip().strip("'")) or {}


def running_labels(ssh: str | None) -> dict[str, dict[str, str]]:
    """Labels par conteneur en service."""
    names = _docker(["ps", "--format", "'{{.Names}}'"], ssh).split()
    labels: dict[str, dict[str, str]] = {}
    for name in (n.strip("'") for n in names):
        raw = _docker(["inspect", "--format", "'{{json .Config.Labels}}'", name], ssh).strip().strip("'")
        labels[name] = json.loads(raw) or {}
    return labels


def evaluate(candidate: dict[str, str], running: dict[str, dict[str, str]], allow_missing: bool = False) -> tuple[list[str], list[str]]:
    """Retourne (erreurs, notes). Fonction pure, testée sans Docker."""
    errors: list[str] = []
    notes: list[str] = []
    module = candidate.get(kit.LABEL_MODULE)
    if not module:
        return [f"image sans label {kit.LABEL_MODULE} : compatibilité inconnue"], notes

    others = {name: labels for name, labels in running.items() if labels.get(kit.LABEL_MODULE) and labels[kit.LABEL_MODULE] != module}
    for name, labels in running.items():
        if not labels.get(kit.LABEL_MODULE) and labels.get("org.opencontainers.image.title", "").startswith("CFAO"):
            notes.append(f"{name} : image CFAO sans labels de contrat, non vérifiée")

    provided = {}
    for name, labels in others.items():
        for cid, version in kit.parse_label(labels.get(kit.LABEL_PROVIDES)).items():
            provided.setdefault(cid, []).append((name, version))

    for cid, version_range in kit.parse_label(candidate.get(kit.LABEL_CONSUMES)).items():
        offers = provided.get(cid, [])
        if not offers:
            (notes if allow_missing else errors).append(f"{module} consomme {cid}@{version_range} : aucun fournisseur en service")
        for name, version in offers:
            if not kit.satisfies(version, version_range):
                errors.append(f"{module} consomme {cid}@{version_range} mais {name} fournit {version}")

    for cid, version in kit.parse_label(candidate.get(kit.LABEL_PROVIDES)).items():
        for name, labels in others.items():
            version_range = kit.parse_label(labels.get(kit.LABEL_CONSUMES)).get(cid)
            if version_range and not kit.satisfies(version, version_range):
                errors.append(f"{module} fournirait {cid}@{version} mais {name} attend {version_range}")
    return errors, notes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("image")
    parser.add_argument("--ssh", help="hôte SSH où lire les conteneurs en service")
    parser.add_argument("--allow-missing", action="store_true", help="fournisseur absent = note, pas erreur")
    args = parser.parse_args(argv)
    errors, notes = evaluate(image_labels(args.image), running_labels(args.ssh), args.allow_missing)
    for note in notes:
        print(f"note : {note}")
    for error in errors:
        print(f"refus : {error}")
    print(f"{args.image} : {'déployable' if not errors else 'NON déployable'}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
