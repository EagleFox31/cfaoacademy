"""Migration des comptes de module vers le realm commun `cfao` (fédération L5).

Sources :
- needs : export du realm `cfao-needs` (`kc.sh export`, utilisateurs dans le
  fichier) ; les mots de passe sont repris tels quels (hash argon2 Keycloak).
- comptes rendus : `profils.json` des comptes locaux ; leurs empreintes scrypt
  sont illisibles par Keycloak, d'où un mot de passe temporaire, à changer à la
  première connexion.

Chaque compte garde son id : les modules indexent leurs données par `sub`
(needs) ou par l'id du profil (CR, ex. `Photo.owner`), rien n'est réécrit.

Idempotent : un compte déjà présent (même id) est ignoré, jamais écrasé (un
mot de passe changé depuis la migration n'est pas réinitialisé).
Sans `--appliquer`, rien n'est écrit : le plan seul est affiché.

    python migrer_comptes.py --kc-url URL --needs-export export.json \\
        --cr-profils profils.json --sortie-mdp mdp.txt [--appliquer]
"""
from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
from pathlib import Path

import requests

REALM = "cfao"
# Attributs de périmètre reconnus par le user profile du realm commun.
ATTRIBUTS = ("scopeNode", "departments", "brands", "orgPath", "locale")
# Rôles techniques propres à chaque realm Keycloak, jamais migrés.
ROLES_TECHNIQUES = {"offline_access", "uma_authorization"}


class MigrationRefusee(Exception):
    """Les sources contiennent des comptes qu'on ne peut pas migrer sans décision."""

    def __init__(self, problemes):
        super().__init__("\n".join(problemes))
        self.problemes = problemes


def comptes_needs(export: dict) -> list[dict]:
    """Les utilisateurs d'un export de realm, au format d'import Keycloak."""
    comptes = []
    for u in export.get("users", []):
        if u.get("serviceAccountClientId"):
            continue
        roles = [r for r in u.get("realmRoles", [])
                 if r not in ROLES_TECHNIQUES and not r.startswith("default-roles-")]
        comptes.append({
            "id": u["id"], "username": u["username"].lower(),
            "email": u.get("email"), "emailVerified": bool(u.get("emailVerified")),
            "firstName": u.get("firstName"), "lastName": u.get("lastName"),
            "enabled": u.get("enabled", True),
            "attributes": {k: v for k, v in (u.get("attributes") or {}).items() if k in ATTRIBUTS},
            "realmRoles": roles,
            "credentials": [c for c in u.get("credentials", []) if c.get("type") == "password"],
            "requiredActions": u.get("requiredActions", []),
        })
    return comptes


def comptes_cr(profils: list[dict], generer=lambda: secrets.token_urlsafe(12)):
    """Les comptes locaux CR au format d'import Keycloak, et leurs mots de passe temporaires."""
    comptes, mots_de_passe, problemes = [], {}, []
    for p in profils:
        noeuds = p.get("scopeNodes") or []
        if len(noeuds) != 1:
            # Le realm porte un seul scopeNode par personne : choix à faire par un humain.
            problemes.append(f"CR {p.get('id')} : {len(noeuds)} périmètres, un seul attendu")
            continue
        mdp = generer()
        username = str(p["identifiant"]).strip().lower()
        mots_de_passe[username] = mdp
        comptes.append({
            "id": str(p["id"]), "username": username,
            "firstName": p.get("firstName"), "lastName": p.get("lastName"),
            "enabled": True,
            "attributes": {"scopeNode": noeuds, "brands": p.get("brands") or [],
                           "departments": p.get("departments") or []},
            "realmRoles": list(p.get("roles") or []),
            "credentials": [{"type": "password", "value": mdp, "temporary": True}],
            "requiredActions": ["UPDATE_PASSWORD"],
        })
    if problemes:
        raise MigrationRefusee(problemes)
    return comptes, mots_de_passe


def verifier(comptes: list[dict], roles_cible: set[str]) -> None:
    """Refuse tout doublon (un compte par personne) et tout rôle inconnu du realm."""
    problemes, vus = [], {}
    for c in comptes:
        for cle, valeur in (("id", c["id"]), ("username", c["username"]),
                            ("email", (c.get("email") or "").lower())):
            if not valeur:
                continue
            if (cle, valeur) in vus:
                problemes.append(f"{cle} en double : {valeur} ({vus[(cle, valeur)]} et {c['id']})")
            vus[(cle, valeur)] = c["id"]
        inconnus = set(c["realmRoles"]) - roles_cible
        if inconnus:
            problemes.append(f"{c['id']} : rôles absents du realm {sorted(inconnus)}")
    if problemes:
        raise MigrationRefusee(problemes)


class Keycloak:
    def __init__(self, url: str, admin: str, mot_de_passe: str):
        self.url = url.rstrip("/")
        r = requests.post(f"{self.url}/realms/master/protocol/openid-connect/token", data={
            "grant_type": "password", "client_id": "admin-cli",
            "username": admin, "password": mot_de_passe}, timeout=30)
        r.raise_for_status()
        self.s = requests.Session()
        self.s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"

    def roles(self) -> set[str]:
        r = self.s.get(f"{self.url}/admin/realms/{REALM}/roles", params={"max": 1000}, timeout=30)
        r.raise_for_status()
        return {x["name"] for x in r.json()}

    def existe(self, ident: str) -> bool:
        r = self.s.get(f"{self.url}/admin/realms/{REALM}/users/{ident}", timeout=30)
        if r.status_code not in (200, 404):
            r.raise_for_status()
        return r.status_code == 200

    def importer(self, comptes: list[dict]) -> dict:
        r = self.s.post(f"{self.url}/admin/realms/{REALM}/partialImport", timeout=120,
                        json={"ifResourceExists": "SKIP", "users": comptes})
        r.raise_for_status()
        return r.json()


def planifier(kc: Keycloak, comptes: list[dict]) -> tuple[list[dict], list[dict]]:
    """(à créer, déjà présents) : la vérification passe avant toute écriture."""
    verifier(comptes, kc.roles())
    presents = [c for c in comptes if kc.existe(c["id"])]
    ids = {c["id"] for c in presents}
    return [c for c in comptes if c["id"] not in ids], presents


def _ecrire_mots_de_passe(chemin: Path, mots_de_passe: dict) -> None:
    fd = os.open(chemin, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        for username, mdp in sorted(mots_de_passe.items()):
            f.write(f"{username}\t{mdp}\n")


def main(argv=None) -> int:
    a = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    a.add_argument("--kc-url", required=True)
    a.add_argument("--needs-export", type=Path)
    a.add_argument("--cr-profils", type=Path)
    a.add_argument("--sortie-mdp", type=Path, help="mots de passe temporaires CR (fichier 600)")
    a.add_argument("--appliquer", action="store_true")
    o = a.parse_args(argv)
    if o.cr_profils and not o.sortie_mdp:
        a.error("--sortie-mdp est obligatoire avec --cr-profils")

    comptes, mots_de_passe = [], {}
    try:
        if o.needs_export:
            comptes += comptes_needs(json.loads(o.needs_export.read_text(encoding="utf-8")))
        if o.cr_profils:
            cr, mots_de_passe = comptes_cr(json.loads(o.cr_profils.read_text(encoding="utf-8")))
            comptes += cr
        kc = Keycloak(o.kc_url, os.environ.get("KC_ADMIN", "admin"), os.environ["KC_ADMIN_PASSWORD"])
        a_creer, presents = planifier(kc, comptes)
    except MigrationRefusee as exc:
        print("Migration refusée, rien n'a été écrit :", *exc.problemes, sep="\n- ", file=sys.stderr)
        return 2

    print(f"{len(a_creer)} compte(s) à créer, {len(presents)} déjà présent(s) (ignorés).")
    if not o.appliquer:
        print("À blanc : relancer avec --appliquer pour écrire.")
        return 0
    if a_creer:
        resultat = kc.importer(a_creer)
        print(f"Créés : {resultat.get('added', 0)}, ignorés : {resultat.get('skipped', 0)}.")
    nouveaux = {c["username"] for c in a_creer}
    if o.sortie_mdp:
        _ecrire_mots_de_passe(o.sortie_mdp, {u: m for u, m in mots_de_passe.items() if u in nouveaux})
        print(f"Mots de passe temporaires des nouveaux comptes CR : {o.sortie_mdp}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
