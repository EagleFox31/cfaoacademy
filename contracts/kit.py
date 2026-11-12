"""Outils communs du registre de contrats inter-modules.

Bibliothèque standard seulement, sauf les validateurs (jsonschema), importés à
la demande pour que `check.py`, `sync.py` et `can_i_deploy.py` tournent sans
dépendance. Tout ce qui varie d'un projet à l'autre (espace de noms des labels,
modules, images, formats) vient de `registry.json`.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = ROOT / "contracts" / "registry.json"

_SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")
_RANGE = re.compile(r"^\^(\d+)(?:\.(\d+))?(?:\.(\d+))?$")

# Version d'un document selon son format. Un format absent ici est refusé par check.py.
FORMATS = {
    "openapi": lambda spec: spec["info"]["version"],
    "asyncapi": lambda spec: spec["info"]["version"],
    "jsonschema": lambda spec: spec["x-version"],
}


def load_registry() -> dict:
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def label_keys(registry: dict | None = None) -> tuple[str, str, str]:
    namespace = (registry or load_registry())["label_namespace"]
    return f"{namespace}.module", f"{namespace}.contracts.provides", f"{namespace}.contracts.consumes"


LABEL_MODULE, LABEL_PROVIDES, LABEL_CONSUMES = label_keys()


def contract(contract_id: str) -> dict:
    for entry in load_registry()["contracts"]:
        if entry["id"] == contract_id:
            return entry
    raise KeyError(contract_id)


def load_spec(contract_id: str) -> dict:
    return json.loads((ROOT / contract(contract_id)["spec"]).read_text(encoding="utf-8"))


def spec_version(entry: dict, spec: dict) -> str:
    return FORMATS[entry.get("format", "openapi")](spec)


def parse_version(text: str) -> tuple[int, int, int]:
    match = _SEMVER.match(text or "")
    if not match:
        raise ValueError(f"version non semver : {text!r}")
    return tuple(int(part) for part in match.groups())  # type: ignore[return-value]


def satisfies(version: str, version_range: str) -> bool:
    """`^1` accepte 1.x.y ; `^1.2` accepte 1.y.z avec y >= 2 ; sinon égalité stricte."""
    current = parse_version(version)
    match = _RANGE.match(version_range or "")
    if not match:
        return current == parse_version(version_range)
    floor = tuple(int(part or 0) for part in match.groups())
    return current[0] == floor[0] and current >= floor


def parse_label(value: str | None) -> dict[str, str]:
    """`a@1.0.0,b@^2` -> {"a": "1.0.0", "b": "^2"}."""
    pairs: dict[str, str] = {}
    for item in (value or "").split(","):
        item = item.strip()
        if not item:
            continue
        name, _, version = item.partition("@")
        pairs[name] = version
    return pairs


def format_label(pairs: dict[str, str]) -> str:
    return ",".join(f"{name}@{pairs[name]}" for name in sorted(pairs))


def expected_labels(registry: dict | None = None) -> dict[str, dict[str, str]]:
    """Labels non vides que chaque module déclaré doit porter, déduits du registre et des specs.

    Les entrées invalides (format inconnu, spec absente, module non déclaré) sont
    ignorées ici : `check.py` les signale.
    """
    registry = registry or load_registry()
    module_key, provides_key, consumes_key = label_keys(registry)
    provides: dict[str, dict[str, str]] = {module: {} for module in registry["modules"]}
    consumes: dict[str, dict[str, str]] = {module: {} for module in registry["modules"]}
    for entry in registry["contracts"]:
        spec_path = ROOT / entry["spec"]
        if entry.get("format", "openapi") not in FORMATS or not spec_path.is_file():
            continue
        if entry["provider"] in provides:
            provides[entry["provider"]][entry["id"]] = spec_version(entry, json.loads(spec_path.read_text(encoding="utf-8")))
        for consumer in entry["consumers"]:
            if consumer["module"] in consumes:
                consumes[consumer["module"]][entry["id"]] = consumer["range"]
    labels: dict[str, dict[str, str]] = {}
    for module in registry["modules"]:
        labels[module] = {module_key: module}
        if provides[module]:
            labels[module][provides_key] = format_label(provides[module])
        if consumes[module]:
            labels[module][consumes_key] = format_label(consumes[module])
    return labels


def image_repository(image: str) -> str:
    """`registre:5000/org/app:v1@sha256:...` -> `registre:5000/org/app`."""
    image = image.split("@", 1)[0]
    head, _, tail = image.rpartition("/")
    return f"{head}/{tail.split(':', 1)[0]}" if head else tail.split(":", 1)[0]


def module_of(image: str, labels: dict[str, str], registry: dict | None = None) -> str | None:
    """Module d'une image : son label, sinon (image antérieure au registre) son dépôt déclaré."""
    registry = registry or load_registry()
    module_key = label_keys(registry)[0]
    if labels.get(module_key):
        return labels[module_key]
    repository = image_repository(image)
    for module, declared in registry["modules"].items():
        if repository in declared.get("images", []):
            return module
    return None


def operation(spec: dict, path: str, method: str = "get") -> dict:
    return spec["paths"][path][method]


def _bundled(spec: dict, schema: dict) -> dict:
    bundled = {**schema, "$defs": spec.get("components", {}).get("schemas", {})}
    return json.loads(json.dumps(bundled).replace("#/components/schemas/", "#/$defs/"))


def response_schema(spec: dict, path: str, status: int | str, method: str = "get") -> dict:
    response = operation(spec, path, method)["responses"][str(status)]
    return _bundled(spec, response["content"]["application/json"]["schema"])


def response_validator(spec: dict, path: str, status: int | str, method: str = "get"):
    from jsonschema import Draft202012Validator, FormatChecker

    return Draft202012Validator(response_schema(spec, path, status, method), format_checker=FormatChecker())


def response_example(spec: dict, path: str, status: int | str = 200, method: str = "get") -> dict:
    """Premier exemple du schéma de réponse, suivi à travers une `$ref`."""
    schema = operation(spec, path, method)["responses"][str(status)]["content"]["application/json"]["schema"]
    if "$ref" in schema:
        schema = spec["components"]["schemas"][schema["$ref"].rsplit("/", 1)[-1]]
    return schema["examples"][0]


def request_body_validator(spec: dict, path: str, method: str = "post"):
    """Validateur du corps JSON qu'un consommateur envoie (`requestBody`)."""
    from jsonschema import Draft202012Validator, FormatChecker

    schema = operation(spec, path, method)["requestBody"]["content"]["application/json"]["schema"]
    return Draft202012Validator(_bundled(spec, schema), format_checker=FormatChecker())


def request_errors(spec: dict, path: str, params: dict | None, headers: dict | None, method: str = "get") -> list[str]:
    """Écarts d'une requête de consommateur : paramètre inconnu ou hors schéma, en-tête de sécurité absent."""
    from jsonschema import Draft202012Validator

    errors: list[str] = []
    if path not in spec["paths"] or method not in spec["paths"][path]:
        return [f"{method.upper()} {path} absent du contrat"]
    declared = {p["name"]: p for p in operation(spec, path, method).get("parameters", []) if p["in"] == "query"}
    for name, value in (params or {}).items():
        if name not in declared:
            errors.append(f"paramètre {name!r} non déclaré")
            continue
        for error in Draft202012Validator(declared[name]["schema"]).iter_errors(value):
            errors.append(f"paramètre {name!r} : {error.message}")
    for name, parameter in declared.items():
        if parameter.get("required") and name not in (params or {}):
            errors.append(f"paramètre requis {name!r} absent")
    sent = {key.lower() for key in (headers or {})}
    schemes = spec.get("components", {}).get("securitySchemes", {})
    for requirement in operation(spec, path, method).get("security", spec.get("security", [])):
        for scheme_name in requirement:
            scheme = schemes[scheme_name]
            if scheme.get("in") == "header" and scheme["name"].lower() not in sent:
                errors.append(f"en-tête {scheme['name']!r} absent")
    return errors
