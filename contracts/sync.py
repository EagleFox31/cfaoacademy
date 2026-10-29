"""Réconcilie les labels de contrats des Dockerfiles avec le registre.

    python contracts/sync.py            # écrit seulement ce qui dérive
    python contracts/sync.py --check    # n'écrit rien, code 1 si dérive

Le script ne possède que le bloc délimité par MARK_BEGIN / MARK_END, placé dans
l'étape finale du Dockerfile. Tout le reste du fichier est préservé. Un label de
l'espace de noms déclaré trouvé hors du bloc est un conflit : il est signalé,
jamais modifié. Un second passage sur un état convergé n'écrit rien.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import kit

MARK_BEGIN = "# contracts:begin - bloc géré par contracts/sync.py, ne pas éditer"
MARK_END = "# contracts:end"
_BLOCK = re.compile(rf"^{re.escape(MARK_BEGIN)}\n.*?^{re.escape(MARK_END)}\n", re.MULTILINE | re.DOTALL)
_FROM = re.compile(r"^FROM\s", re.MULTILINE | re.IGNORECASE)


def render_block(labels: dict[str, str]) -> str:
    keys = sorted(labels)
    lines = [f'LABEL {keys[0]}="{labels[keys[0]]}"']
    lines += [f'      {key}="{labels[key]}"' for key in keys[1:]]
    return f"{MARK_BEGIN}\n" + " \\\n".join(lines) + f"\n{MARK_END}\n"


def reconcile(text: str, labels: dict[str, str], namespace: str) -> tuple[str, list[str]]:
    """Retourne (texte réconcilié, conflits). Fins de ligne d'origine conservées."""
    crlf = "\r\n" in text
    body = text.replace("\r\n", "\n")
    if body and not body.endswith("\n"):
        body += "\n"
    block = render_block(labels)

    outside = _BLOCK.sub("", body)
    flat = re.sub(r"\\\n", " ", outside)
    conflicts = [
        f"label {key} hors du bloc géré"
        for line in flat.splitlines()
        if line.strip().upper().startswith("LABEL ")
        for key in re.findall(rf"({re.escape(namespace)}\.[\w.-]+)=", line)
    ]

    if _BLOCK.search(body):
        result = _BLOCK.sub(lambda _: block, body, count=1)
    else:
        starts = [match.start() for match in _FROM.finditer(body)]
        if not starts:
            return text, ["aucune instruction FROM"]
        line_end = body.index("\n", starts[-1]) + 1
        result = body[:line_end] + block + body[line_end:]
    if crlf:
        result = result.replace("\n", "\r\n")
    return result, conflicts


def sync(write: bool) -> tuple[list[Path], list[str]]:
    """Retourne (fichiers en dérive, conflits). N'écrit que si `write` et sans conflit."""
    registry = kit.load_registry()
    drifted: list[Path] = []
    conflicts: list[str] = []
    for module, labels in kit.expected_labels(registry).items():
        path = kit.ROOT / registry["modules"][module]["dockerfile"]
        current = path.read_bytes().decode("utf-8")
        desired, found = reconcile(current, labels, registry["label_namespace"])
        conflicts += [f"{path.relative_to(kit.ROOT).as_posix()} : {item}" for item in found]
        if desired == current:
            continue
        drifted.append(path)
        if write and not found:
            path.write_bytes(desired.encode("utf-8"))
    return drifted, conflicts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="signaler la dérive sans écrire")
    args = parser.parse_args(argv)
    drifted, conflicts = sync(write=not args.check)
    for conflict in conflicts:
        print(f"conflit : {conflict}")
    for path in drifted:
        print(f"{'dérive' if args.check else 'réconcilié'} : {path.relative_to(kit.ROOT).as_posix()}")
    if not drifted and not conflicts:
        print("labels : convergés, aucune écriture")
    return 1 if conflicts or (args.check and drifted) else 0


if __name__ == "__main__":
    sys.exit(main())
