"""Puis-je déployer cette image sans casser les modules en service ?

    python contracts/can_i_deploy.py IMAGE[:TAG] [--ssh HÔTE] [--allow-missing]

Lit les labels de l'image candidate (`docker image inspect`, en local, après
`docker pull` si elle manque) et
l'image et les labels des conteneurs en service (`docker inspect`, en local ou
par SSH, lecture seule). Vérifie les deux sens :
- chaque contrat consommé par l'image est fourni, en version compatible, par
  un module en service ;
- chaque module en service qui consomme un contrat fourni par l'image accepte
  sa version.

Un conteneur est rattaché à un module par son label, sinon par le dépôt de son
image déclaré dans `registry.json` (images antérieures au registre). Un module
rattaché sans labels de contrat a une version inconnue : s'il est concerné, le
verdict est « inconnu ». Les conteneurs étrangers au registre et ceux du même
module que l'image sont ignorés.

Code de sortie : 0 déployable, 1 incompatible, 2 inconnu.
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


def _json(args: list[str], ssh: str | None):
    return json.loads(_docker(args, ssh).strip().strip("'"))


def image_labels(image: str) -> dict[str, str]:
    """Labels de l'image candidate, tirée du registre si elle manque en local."""
    inspect = ["image", "inspect", "--format", "'{{json .Config.Labels}}'", image]
    try:
        return _json(inspect, None) or {}
    except subprocess.CalledProcessError:
        _docker(["pull", "-q", image], None)
        return _json(inspect, None) or {}


def running_containers(ssh: str | None) -> dict[str, dict]:
    """{conteneur: {"image": référence, "labels": labels}} des conteneurs en service."""
    names = [name.strip("'") for name in _docker(["ps", "--format", "'{{.Names}}'"], ssh).split()]
    containers: dict[str, dict] = {}
    for name in names:
        config = _json(["inspect", "--format", "'{{json .Config}}'", name], ssh)
        containers[name] = {"image": config.get("Image", ""), "labels": config.get("Labels") or {}}
    return containers


def evaluate(image: str, labels: dict[str, str], running: dict[str, dict], registry: dict | None = None,
             allow_missing: bool = False) -> tuple[list[str], list[str], list[str]]:
    """Retourne (erreurs, inconnus, notes). Fonction pure, testée sans Docker."""
    registry = registry or kit.load_registry()
    module_key, provides_key, consumes_key = kit.label_keys(registry)
    errors: list[str] = []
    unknown: list[str] = []
    notes: list[str] = []

    module = kit.module_of(image, labels, registry)
    if module is None:
        return errors, [f"{image} : module inconnu (ni label {module_key}, ni dépôt déclaré)"], notes
    if not labels.get(module_key):
        return errors, [f"{image} : image de {module} sans labels de contrat"], notes

    # Modules en service : déclarés (labels) ou version inconnue (image antérieure au registre).
    labelled: dict[str, dict[str, str]] = {}
    legacy: dict[str, str] = {}
    for name, container in running.items():
        other = kit.module_of(container["image"], container["labels"], registry)
        if other is None or other == module:
            continue
        if container["labels"].get(module_key):
            labelled[name] = container["labels"]
        else:
            legacy[name] = other
    contracts = {entry["id"]: entry for entry in registry["contracts"]}

    for cid, version_range in kit.parse_label(labels.get(consumes_key)).items():
        offers = [(name, kit.parse_label(other.get(provides_key))[cid])
                  for name, other in labelled.items() if cid in kit.parse_label(other.get(provides_key))]
        provider = contracts.get(cid, {}).get("provider")
        blind = [name for name, other in legacy.items() if other == provider]
        for name, version in offers:
            if not kit.satisfies(version, version_range):
                errors.append(f"{module} consomme {cid}@{version_range} mais {name} fournit {version}")
        unknown += [f"{module} consomme {cid}@{version_range} : version servie par {name} inconnue (sans labels)" for name in blind]
        if not offers and not blind:
            (notes if allow_missing else errors).append(f"{module} consomme {cid}@{version_range} : aucun fournisseur en service")

    for cid, version in kit.parse_label(labels.get(provides_key)).items():
        for name, other in labelled.items():
            version_range = kit.parse_label(other.get(consumes_key)).get(cid)
            if version_range and not kit.satisfies(version, version_range):
                errors.append(f"{module} fournirait {cid}@{version} mais {name} attend {version_range}")
        consumers = {consumer["module"] for consumer in contracts.get(cid, {}).get("consumers", [])}
        unknown += [f"{module} fournirait {cid}@{version} : plage attendue par {name} inconnue (sans labels)"
                    for name, other in legacy.items() if other in consumers]
    return errors, unknown, notes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("image")
    parser.add_argument("--ssh", help="hôte SSH où lire les conteneurs en service")
    parser.add_argument("--allow-missing", action="store_true", help="fournisseur absent = note, pas erreur")
    args = parser.parse_args(argv)
    errors, unknown, notes = evaluate(args.image, image_labels(args.image), running_containers(args.ssh),
                                      allow_missing=args.allow_missing)
    for note in notes:
        print(f"note : {note}")
    for item in unknown:
        print(f"inconnu : {item}")
    for error in errors:
        print(f"refus : {error}")
    verdict = "NON déployable" if errors else "compatibilité inconnue" if unknown else "déployable"
    print(f"{args.image} : {verdict}")
    return 1 if errors else 2 if unknown else 0


if __name__ == "__main__":
    sys.exit(main())
