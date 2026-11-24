#!/usr/bin/env python3
"""Construit l'image d'un module avec ses étiquettes de version et de nouveautés.

    python scripts/build_image.py <contexte> <image> <tag> [--changelog CHANGELOG.md]
        [--dockerfile chemin] [--dry-run] [-- <options docker build>]

Étiquettes posées (lues par la supervision, écran « version et nouveautés ») :
- org.opencontainers.image.version  : le tag (v0.1.0) ;
- org.opencontainers.image.revision : commit git, suffixé « -dirty » si le contexte a
  des modifications non commitées ;
- org.opencontainers.image.created  : date du commit (UTC, ISO 8601) : deux builds de la
  même version donnent les mêmes étiquettes ;
- org.cfao.changelog                : section « ## [0.1.0] » du CHANGELOG.md du module,
  4000 caractères au plus. Une version publiée sans sa section est refusée.

Un tag déjà présent sur le registre est refusé (sauf --force) : une version publiée ne
change plus sous les serveurs qui l'ont tirée.

Les étiquettes passent par `docker build --label` : elles priment sur les LABEL du
Dockerfile et ne cassent pas le cache. `--build-arg VERSION` alimente le `ARG VERSION`
des Dockerfiles, déclaré en fin de fichier pour la même raison.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_changelog import extract  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
CHANGELOG_MAX = 4000
TAG = re.compile(r"^v?(\d+\.\d+\.\d+)$")


def semver(tag: str) -> str:
    match = TAG.match(tag)
    if not match:
        raise SystemExit(f"tag {tag!r} : attendu vX.Y.Z (ex. v0.1.0)")
    return match.group(1)


def changelog_section(tag: str, changelog: Path) -> str:
    section = extract(semver(tag), changelog)
    if not section:
        raise SystemExit(f"section ## [{semver(tag)}] vide dans {changelog}")
    if len(section) <= CHANGELOG_MAX:
        return section
    # Coupe sur une fin de ligne : jamais un mot ou une puce à moitié.
    cut = section[: CHANGELOG_MAX - 2].rsplit("\n", 1)[0]
    return cut + "\n…"


def _git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True,
                          text=True).stdout.strip()


def revision(context: Path) -> str:
    commit = _git("rev-parse", "HEAD")
    dirty = _git("status", "--porcelain", "--", str(context.resolve()))
    return commit + ("-dirty" if dirty else "")


def created() -> str:
    """Date du commit, pas l'heure du build : reconstruire la même version donne les
    mêmes étiquettes (idempotent)."""
    epoch = int(_git("log", "-1", "--format=%ct", "HEAD"))
    return datetime.fromtimestamp(epoch, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def published(image: str, tag: str) -> bool:
    """Vrai si le tag existe déjà sur le registre (un tag publié ne bouge plus)."""
    result = subprocess.run(["docker", "manifest", "inspect", f"{image}:{tag}"],
                            capture_output=True, text=True)
    if result.returncode == 0:
        return True
    if "no such manifest" in (result.stderr + result.stdout).lower():
        return False
    raise SystemExit(f"registre injoignable pour {image}:{tag} : {result.stderr.strip()[:200]}")


def command(context: Path, image: str, tag: str, changelog: Path | None,
            dockerfile: Path | None, extra: list[str]) -> list[str]:
    labels = {
        "org.opencontainers.image.version": tag,
        "org.opencontainers.image.revision": revision(context),
        "org.opencontainers.image.created": created(),
    }
    if changelog is not None:
        labels["org.cfao.changelog"] = changelog_section(tag, changelog)
    cmd = ["docker", "build", "-t", f"{image}:{tag}", "--build-arg", f"VERSION={tag}"]
    for key, value in labels.items():
        cmd += ["--label", f"{key}={value}"]
    if dockerfile is not None:
        cmd += ["-f", str(dockerfile)]
    return cmd + extra + [str(context)]


def exiger_verrou(context: Path, who: str) -> None:
    """Refuse de construire sans le verrou build:<contexte> pris par --who : deux sessions
    ne construisent jamais la même image en même temps (docs/engineering/coordination.md)."""
    import coord  # noqa: PLC0415

    try:
        ressource = "build:" + context.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        raise SystemExit(f"contexte {context} hors du dépôt {ROOT} : lancer le script du "
                         "worktree qui contient ce contexte") from None
    if not who:
        raise SystemExit(f"verrou requis : python scripts/coord.py lock {ressource} --who <session>, "
                         "puis relancer avec --who <session> (ou COORD_WHO)")
    verrou = coord.lire_verrou(coord.chemin_verrou(ressource))
    if verrou is None:
        raise SystemExit(f"{ressource} n'est pas verrouillé : python scripts/coord.py lock "
                         f"{ressource} --who {who} --why <motif>")
    if verrou["qui"] != who:
        raise SystemExit(f"{ressource} est pris par {verrou['qui']} ({verrou['pourquoi'] or 'sans motif'}) : "
                         "attendre qu'il le libère")


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    extra: list[str] = []
    if "--" in argv:
        extra = argv[argv.index("--") + 1:]
        argv = argv[: argv.index("--")]
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    parser.add_argument("context", type=Path)
    parser.add_argument("image", help="ex. antifragile237/cfao-supervision-api")
    parser.add_argument("tag", help="ex. v0.1.0")
    parser.add_argument("--changelog", type=Path)
    parser.add_argument("--dockerfile", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="affiche la commande sans la lancer")
    parser.add_argument("--who", default=os.environ.get("COORD_WHO", ""),
                        help="nom de la session qui tient le verrou build:<module> (ou COORD_WHO)")
    parser.add_argument("--force", action="store_true",
                        help="reconstruit un tag déjà publié (à éviter : il change sous les serveurs)")
    args = parser.parse_args(argv)
    if not args.context.is_dir():
        raise SystemExit(f"contexte introuvable : {args.context}")
    cmd = command(args.context, args.image, args.tag, args.changelog, args.dockerfile, extra)
    if args.dry_run:
        print(subprocess.list2cmdline(cmd))
        return 0
    exiger_verrou(args.context, args.who)
    if not args.force and published(args.image, args.tag):
        raise SystemExit(f"{args.image}:{args.tag} est déjà publié : passer à la version suivante "
                         "(ou --force en connaissance de cause)")
    return subprocess.run(cmd).returncode


if __name__ == "__main__":
    sys.exit(main())
