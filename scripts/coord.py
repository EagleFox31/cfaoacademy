#!/usr/bin/env python3
"""Coordination entre sessions : verrous de build, images touchées, état des commits.

    python scripts/coord.py impact [--base REF]      images à reconstruire (ce qui a changé)
    python scripts/coord.py lock <ressource> --who NOM [--why TEXTE] [--ttl MIN]
    python scripts/coord.py unlock <ressource> --who NOM [--force]
    python scripts/coord.py status                   verrous en cours
    python scripts/coord.py daily                    fichiers non commités par zone, âge du dernier commit
    python scripts/coord.py board                    tableau « qui fait quoi »
    python scripts/coord.py daily --strict           code 1 si trop de non commité ou commit trop vieux
    python scripts/coord.py release add <image> --who NOM --note TEXTE
    python scripts/coord.py release ready <n> --who NOM --proof TEXTE
    python scripts/coord.py release show | freeze | done

Ressources usuelles : build:<image> (ex. build:cfao-planning/api), front-container,
recette-restart, deploy:serveur.

L'état vit dans <dépôt>/.git/cfao-coordination/ : jamais commité, partagé par tous les
worktrees. Un verrou est créé de façon atomique (O_EXCL) : deux sessions ne peuvent pas
le prendre en même temps. Un verrou expire après --ttl minutes (30 par défaut) : une
session tombée ne bloque personne.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Dossiers qui n'ont aucun effet sur une image : jamais de reconstruction pour eux.
SANS_IMAGE = ("docs/", "scripts/", "scratch/", "_archive/", ".github/", "contracts/")
SANS_IMAGE_FICHIERS = (".md", ".txt", ".lnk", ".dump", ".xlsx", ".xlsm", ".xlsb", ".pdf", ".docx")
# Sous-dossiers d'un module qui donnent leur propre image.
SOUS_IMAGES = {"api", "web", "gateway", "worker", "collector", "socket"}
# Un changement ici touche plusieurs images (code d'authentification copié par module).
PARTAGE_AUTH = ("core/auth/",)
SEUIL_FICHIERS, SEUIL_HEURES = 40, 24
MODULES_DJANGO = ("cfao-core", "cfao-planning", "cfao-needs", "cfao-comptes-rendus",
                  "cfao-supervision", "cfao-academy-mail")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True,
                          text=True).stdout


def etat_dir() -> Path:
    commun = Path(git("rev-parse", "--git-common-dir").strip())
    base = commun if commun.is_absolute() else ROOT / commun
    dossier = base / "cfao-coordination"
    (dossier / "locks").mkdir(parents=True, exist_ok=True)
    return dossier


def fichiers_modifies(base: str | None) -> list[str]:
    if base:
        sortie = git("diff", "--name-only", base)
    else:
        sortie = git("status", "--porcelain", "-uall")
        sortie = "\n".join(ligne[3:].split(" -> ")[-1] for ligne in sortie.splitlines())
    return [f.strip().strip('"') for f in sortie.splitlines() if f.strip()]


def image_de(chemin: str) -> list[str]:
    if chemin.startswith(SANS_IMAGE) or chemin.endswith(SANS_IMAGE_FICHIERS):
        return []
    parties = chemin.split("/")
    if len(parties) == 1:
        return []
    module = parties[0]
    if any(chemin.startswith(f"{module}/{p}") for p in PARTAGE_AUTH) or \
            "/core/auth/" in chemin:
        return [f"{m}/api" for m in MODULES_DJANGO if m != "cfao-core"] + ["cfao-core"]
    if module == "cerbos":
        return ["cerbos"]
    if len(parties) > 2 and parties[1] in SOUS_IMAGES:
        return [f"{module}/{parties[1]}"]
    return [module]


def cmd_impact(args: argparse.Namespace) -> None:
    images: dict[str, int] = {}
    for f in fichiers_modifies(args.base):
        for image in image_de(f):
            images[image] = images.get(image, 0) + 1
    if not images:
        print("Aucune image à reconstruire (docs, scripts ou rien de modifié).")
        return
    print("Images à reconstruire (fichiers touchés) :")
    for image, n in sorted(images.items()):
        print(f"  {image:<34} {n}")
    print("Tout le reste est inchangé : ne pas y toucher.")


def chemin_verrou(ressource: str) -> Path:
    return etat_dir() / "locks" / (ressource.replace("/", "__").replace(":", "--") + ".json")


def lire_verrou(chemin: Path) -> dict | None:
    try:
        verrou = json.loads(chemin.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    if verrou["expire"] < time.time():
        chemin.unlink(missing_ok=True)
        return None
    return verrou


def cmd_lock(args: argparse.Namespace) -> None:
    chemin = chemin_verrou(args.ressource)
    verrou = {"ressource": args.ressource, "qui": args.who, "pourquoi": args.why,
              "depuis": time.time(), "expire": time.time() + args.ttl * 60}
    for _ in range(2):
        try:
            fd = os.open(chemin, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            actuel = lire_verrou(chemin)
            if actuel is None:
                continue  # expiré et supprimé : on réessaie
            if actuel["qui"] == args.who:
                chemin.write_text(json.dumps(verrou), encoding="utf-8")
                print(f"Verrou {args.ressource} prolongé pour {args.who}.")
                return
            reste = int((actuel["expire"] - time.time()) / 60) + 1
            print(f"OCCUPÉ : {args.ressource} est pris par {actuel['qui']} "
                  f"({actuel['pourquoi'] or 'sans motif'}), libre au plus tard dans {reste} min.")
            sys.exit(1)
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(verrou, f)
        print(f"Verrou {args.ressource} pris par {args.who} pour {args.ttl} min.")
        return
    sys.exit("Verrou impossible à poser.")


def cmd_unlock(args: argparse.Namespace) -> None:
    chemin = chemin_verrou(args.ressource)
    actuel = lire_verrou(chemin)
    if actuel is None:
        print(f"{args.ressource} n'était pas verrouillé.")
        return
    if actuel["qui"] != args.who and not args.force:
        sys.exit(f"Refusé : {args.ressource} appartient à {actuel['qui']}.")
    chemin.unlink(missing_ok=True)
    print(f"Verrou {args.ressource} libéré.")


def cmd_status(_: argparse.Namespace) -> None:
    trouves = [v for p in sorted((etat_dir() / "locks").glob("*.json"))
               if (v := lire_verrou(p))]
    if not trouves:
        print("Aucun verrou : tout est libre.")
    for v in trouves:
        reste = int((v["expire"] - time.time()) / 60) + 1
        print(f"{v['ressource']:<34} {v['qui']:<20} {reste:>3} min  {v['pourquoi'] or ''}")


def cmd_daily(_: argparse.Namespace) -> None:
    par_zone: dict[str, int] = {}
    for f in fichiers_modifies(None):
        zone = f.split("/")[0] if "/" in f else "(racine)"
        par_zone[zone] = par_zone.get(zone, 0) + 1
    dernier = git("log", "-1", "--format=%cr (%ad) %s", "--date=short").strip()
    print(f"Dernier commit : {dernier}")
    print(f"Non commité : {sum(par_zone.values())} fichiers")
    for zone, n in sorted(par_zone.items(), key=lambda x: -x[1]):
        print(f"  {zone:<28} {n}")
    print("Règle : un commit par sujet terminé et testé, au moins un par jour de travail.")


def cmd_board(_: argparse.Namespace) -> None:
    board = etat_dir() / "BOARD.md"
    print(board.read_text(encoding="utf-8") if board.exists() else "Tableau vide.")


# Ordre de construction : ce dont les autres dépendent passe d'abord.
ORDRE = ("cerbos", "keycloak", "cfao-core", "api", "worker", "collector", "socket",
         "gateway", "web", "edge", "frontend")


def rang(image: str) -> tuple[int, str]:
    morceaux = [image] + image.split("/")
    for i, nom in enumerate(ORDRE):
        if nom in morceaux:
            return (i, image)
    return (len(ORDRE), image)


def lire_lot() -> dict:
    chemin = etat_dir() / "release.json"
    if chemin.exists():
        return json.loads(chemin.read_text(encoding="utf-8"))
    return {"items": [], "fige": False}


def ecrire_lot(lot: dict) -> None:
    (etat_dir() / "release.json").write_text(json.dumps(lot, ensure_ascii=False, indent=1),
                                            encoding="utf-8")


def cmd_release(args: argparse.Namespace) -> None:
    lot = lire_lot()
    items = lot["items"]
    if args.action == "add":
        if lot["fige"]:
            sys.exit("Lot figé : on ne peut plus ajouter. Attendre `release done`.")
        items.append({"n": len(items) + 1, "image": args.cible, "qui": args.who,
                      "note": args.note, "pret": False, "preuve": ""})
        ecrire_lot(lot)
        print(f"Ajouté : #{items[-1]['n']} {args.cible} ({args.who}).")
    elif args.action == "ready":
        item = next((i for i in items if str(i["n"]) == args.cible), None)
        if not item:
            sys.exit(f"Pas de ligne #{args.cible}.")
        if item["qui"] != args.who:
            sys.exit(f"Refusé : la ligne #{item['n']} appartient à {item['qui']}.")
        if not args.proof:
            sys.exit("Une preuve est obligatoire (--proof : tests passés, capture UI...).")
        sale = sorted({i for f in fichiers_modifies(None) for i in image_de(f)} &
                      {item["image"]})
        if sale:
            sys.exit(f"Refusé : {item['image']} a des fichiers non commités. Commiter d'abord.")
        item["pret"], item["preuve"] = True, args.proof
        ecrire_lot(lot)
        print(f"#{item['n']} prêt.")
    elif args.action == "show":
        if not items:
            print("File vide.")
        for i in items:
            print(f"#{i['n']} [{'prêt' if i['pret'] else 'EN COURS'}] {i['image']:<30} "
                  f"{i['qui']:<16} {i['note']}")
        print("Lot figé." if lot["fige"] else "Lot ouvert.")
    elif args.action == "freeze":
        attente = [i for i in items if not i["pret"]]
        if attente:
            for i in attente:
                print(f"PAS PRÊT : #{i['n']} {i['image']} ({i['qui']})")
            sys.exit(1)
        if not items:
            sys.exit("File vide.")
        lot["fige"] = True
        ecrire_lot(lot)
        print("Lot figé. Ordre de construction (une fois chacune) :")
        for image in sorted({i["image"] for i in items}, key=rang):
            print(f"  {image}")
        print("Construire depuis un worktree propre au dernier commit :")
        print("  git worktree add --detach ../release-lot HEAD")
        print("Prendre le verrou build:<image> avant chaque build, le libérer après.")
    elif args.action == "done":
        ecrire_lot({"items": [], "fige": False})
        print("Lot clos, file vide.")


def cmd_daily_strict(_: argparse.Namespace) -> None:
    cmd_daily(_)
    fichiers = len(fichiers_modifies(None))
    age_h = (time.time() - int(git("log", "-1", "--format=%ct").strip())) / 3600
    if fichiers > SEUIL_FICHIERS or age_h > SEUIL_HEURES:
        print(f"ALERTE : {fichiers} fichiers non commités, dernier commit il y a {age_h:.0f} h "
              f"(seuils {SEUIL_FICHIERS} fichiers / {SEUIL_HEURES} h).")
        sys.exit(1)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("impact"); s.add_argument("--base"); s.set_defaults(f=cmd_impact)
    s = sub.add_parser("lock"); s.add_argument("ressource"); s.add_argument("--who", required=True)
    s.add_argument("--why", default=""); s.add_argument("--ttl", type=int, default=30)
    s.set_defaults(f=cmd_lock)
    s = sub.add_parser("unlock"); s.add_argument("ressource"); s.add_argument("--who", required=True)
    s.add_argument("--force", action="store_true"); s.set_defaults(f=cmd_unlock)
    sub.add_parser("status").set_defaults(f=cmd_status)
    s = sub.add_parser("daily"); s.add_argument("--strict", action="store_true")
    s.set_defaults(f=lambda a: cmd_daily_strict(a) if a.strict else cmd_daily(a))
    s = sub.add_parser("release")
    s.add_argument("action", choices=["add", "ready", "show", "freeze", "done"])
    s.add_argument("cible", nargs="?", default="")
    s.add_argument("--who", default=""); s.add_argument("--note", default="")
    s.add_argument("--proof", default=""); s.set_defaults(f=cmd_release)
    sub.add_parser("board").set_defaults(f=cmd_board)
    args = p.parse_args()
    args.f(args)


if __name__ == "__main__":
    main()
