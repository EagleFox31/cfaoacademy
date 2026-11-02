"""Garde statique de la regle AGENTS.md section 7 (base creee automatiquement).

Pour chaque compose suivi par git :
  (a) tout service qui consomme une base depend d'un job `<prefix>-migrate`
      construit sur la meme image (ou le meme build) que lui ;
  (b) ce job est ponctuel : `restart: "no"`, ni profiles, ni ports, ni healthcheck ;
  (c) le consommateur l'attend en `condition: service_completed_successfully` ;
  (d) aucun service hors job ne migre ni ne seede (command, entrypoint, ou
      CMD / ENTRYPOINT du Dockerfile quand le compose le construit) ;
  (e) un compose de prod ne lance jamais de donnees de demo.

Usage : python scripts/ci/compose_bootstrap.py [fichiers...]  (defaut : git ls-files)
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

import yaml

BASE_IMAGE = re.compile(r"(^|/)(postgres|mysql|mariadb|mongo)(:|@|$)")
DB_ENV = re.compile(r"(^|_)(DB_HOST|DATABASE_URL|DB_URL)$")
MIGRATE_NAME = re.compile(r"(^|-)migrate$")
MIGRATES = re.compile(r"\bmigrate\b|upgrade head|db push|seed")
DEMO = re.compile(r"--demo|--open|seed_dev|loaddata|sample")

# Services exemptes, avec la raison. Cle : nom de service (regex pleine).
ALLOWLIST = {
    # Keycloak migre son propre schema (Liquibase de l'editeur) au demarrage ;
    # le referentiel (realm) passe par le job keycloak-config-cli.
    r"(needs-)?keycloak": "schema gere par Keycloak (Liquibase editeur)",
    # cfao-operations n'a aucun pilote Postgres : ops-db est rempli hors bande
    # par scripts/ingestion/init_ops_schema.sql.
    r"operations": "aucun acces base dans le code (ingestion hors bande)",
}


class _Loader(yaml.SafeLoader):
    """SafeLoader qui tolere les tags compose (!reset, !override)."""


_Loader.add_multi_constructor("!", lambda loader, suffix, node: None)


def _allowed(name: str) -> bool:
    return any(re.fullmatch(pattern, name) for pattern in ALLOWLIST)


def _env_keys(service: dict) -> list[str]:
    env = service.get("environment") or {}
    if isinstance(env, dict):
        return [str(k) for k in env]
    return [str(item).split("=", 1)[0] for item in env]


def _depends(service: dict) -> dict:
    dep = service.get("depends_on") or {}
    if isinstance(dep, list):
        return {name: {} for name in dep}
    return {name: (cond or {}) for name, cond in dep.items()}


def _text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return " ".join(str(v) for v in value)
    return str(value)


def _build_key(service: dict, base: Path):
    """Identite de ce qui tourne : l'image, sinon le (contexte, Dockerfile) du build."""
    build = service.get("build")
    if build:
        if isinstance(build, str):
            build = {"context": build}
        context = (base / (build.get("context") or ".")).resolve()
        return ("build", str(context), build.get("dockerfile") or "Dockerfile")
    if service.get("image"):
        return ("image", service["image"])
    return None


def _dockerfile_instructions(key) -> dict[str, str]:
    """CMD et ENTRYPOINT du dernier etage du Dockerfile (vide si introuvable)."""
    if not key or key[0] != "build":
        return {}
    path = Path(key[1]) / key[2]
    if not path.is_file():
        return {}
    joined = re.sub(r"\\\r?\n", " ", path.read_text(encoding="utf-8"))
    found: dict[str, str] = {}
    for line in joined.splitlines():
        match = re.match(r"\s*(FROM|CMD|ENTRYPOINT)\b(.*)", line, re.IGNORECASE)
        if not match:
            continue
        word = match.group(1).upper()
        if word == "FROM":
            found = {}
        else:
            found[word] = match.group(2).strip()
    return found


def load(path: Path) -> dict:
    """Services du compose, fusionnes avec l'override voisin (charge par `up`)."""
    data = yaml.load(path.read_text(encoding="utf-8"), Loader=_Loader) or {}
    services = dict(data.get("services") or {})
    override = path.with_name("docker-compose.override.yml")
    if path.name == "docker-compose.yml" and override.is_file():
        extra = yaml.load(override.read_text(encoding="utf-8"), Loader=_Loader) or {}
        for name, patch in (extra.get("services") or {}).items():
            services[name] = {**services.get(name, {}), **(patch or {})}
    return services


def check(path: Path) -> list[str]:
    services = load(path)
    base = path.parent
    where = Path(os.path.relpath(path)).as_posix()
    errors: list[str] = []

    databases = {
        name for name, s in services.items() if BASE_IMAGE.search(str(s.get("image") or ""))
    }
    jobs = {name for name in services if MIGRATE_NAME.search(name)}
    keys = {name: _build_key(s, base) for name, s in services.items()}
    job_keys = {keys[name] for name in jobs if keys[name]}

    for name in sorted(jobs):
        job = services[name]
        if job.get("restart") != "no":
            errors.append(f'{where}: {name} doit avoir restart: "no" (job ponctuel)')
        for forbidden in ("profiles", "ports", "healthcheck"):
            if job.get(forbidden):
                errors.append(f"{where}: {name} ne doit pas declarer {forbidden}")

    for name, service in sorted(services.items()):
        if name in databases or name in jobs or _allowed(name):
            continue
        depends = _depends(service)
        consumer = (
            any(dep in databases for dep in depends)
            or any(DB_ENV.search(key) for key in _env_keys(service))
            or (keys[name] is not None and keys[name] in job_keys)
        )

        launched = {
            "command": _text(service.get("command")),
            "entrypoint": _text(service.get("entrypoint")),
        }
        dockerfile = _dockerfile_instructions(keys[name])
        if not launched["command"] and "CMD" in dockerfile:
            launched["CMD du Dockerfile"] = dockerfile["CMD"]
        if not launched["entrypoint"] and "ENTRYPOINT" in dockerfile:
            launched["ENTRYPOINT du Dockerfile"] = dockerfile["ENTRYPOINT"]
        for origin, text in launched.items():
            if MIGRATES.search(text):
                errors.append(
                    f"{where}: {name} migre ou seede dans son {origin} ; "
                    f"deplacer dans le job <prefix>-migrate"
                )

        if consumer:
            waited = [
                dep
                for dep, cond in depends.items()
                if dep in jobs
                and cond.get("condition") == "service_completed_successfully"
                and keys.get(dep) == keys[name]
            ]
            if not waited:
                errors.append(
                    f"{where}: {name} consomme une base sans attendre un job *-migrate "
                    f"de meme image (depends_on condition: service_completed_successfully)"
                )

    if "prod" in path.name:
        for name, service in sorted(services.items()):
            text = _text(service.get("command")) + " " + _text(service.get("entrypoint"))
            if DEMO.search(text):
                errors.append(f"{where}: {name} lance des donnees de demo en prod")

    return errors


def tracked_composes(root: Path) -> list[Path]:
    out = subprocess.check_output(
        ["git", "ls-files", "*compose*.yml", "*compose*.yaml"], cwd=root, text=True
    )
    return [
        root / line
        for line in out.split()
        if Path(line).name != "docker-compose.override.yml"
    ]


def main(argv: list[str]) -> int:
    root = Path(__file__).resolve().parents[2]
    files = [Path(a).resolve() for a in argv] or tracked_composes(root)
    errors = [e for f in files for e in check(f)]
    for error in errors:
        print(error)
    print(f"{len(files)} composes, {len(errors)} ecart(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
