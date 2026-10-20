"""Import managers MEDACAP → Keycloak + MongoDB.

Pour chaque document `profile: 'Manager'` dans MongoDB academy :
  1. Génère un username normalisé prenom.nom (ex : venance.tonga)
  2. Crée ou met à jour le compte Keycloak (rôle realm team_manager)
  3. Écrit keycloakUsername sur le document MongoDB

Le lookup dans ManagerScopeView peut ainsi retrouver le profil MEDACAP
à partir du username Keycloak (preferred_username dans le JWT).

Idempotent — peut être rejoué sans doublon.

Usage :
    python manage.py import_medacap_managers
    python manage.py import_medacap_managers --dry-run
    python manage.py import_medacap_managers --subsidiary "CAMEROON MOTORS INDUSTRIES"
"""
from __future__ import annotations

import os
import re
import unicodedata
from typing import Any

import requests
from django.core.management.base import BaseCommand

from analytics.services import _db

_KC_URL        = os.environ.get("KEYCLOAK_URL", "")
_KC_ADMIN      = os.environ.get("KEYCLOAK_ADMIN", "admin")
_KC_PW         = os.environ.get("KEYCLOAK_ADMIN_PASSWORD", "admin")
_REALM         = os.environ.get("OIDC_REALM", "cfao")
_DEFAULT_PASSWORD = os.environ.get("MANAGER_IMPORT_PASSWORD", "demo")
_TEMPORARY_PASSWORD = os.environ.get("MANAGER_IMPORT_TEMPORARY", "false").lower() == "true"


# ── Utilitaires ────────────────────────────────────────────────────────────────

def _strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", s)
        if not unicodedata.combining(c)
    )


def _slug(s: str) -> str:
    """Premier mot d'une chaîne, normalisé : minuscule, sans accents, alphanum + tiret."""
    word = (s or "").strip().split()[0] if (s or "").strip() else ""
    word = _strip_accents(word).lower()
    word = re.sub(r"[^a-z0-9-]", "", word)
    return word


def normalize_username(first_name: str, last_name: str) -> str:
    """prenom.nom — premier mot de chaque partie, slugifié."""
    return f"{_slug(first_name)}.{_slug(last_name)}"


def make_unique(base: str, existing: set[str]) -> str:
    """Suffixe numérique si base déjà pris."""
    if base not in existing:
        return base
    i = 2
    while f"{base}{i}" in existing:
        i += 1
    return f"{base}{i}"


# ── Keycloak admin API ─────────────────────────────────────────────────────────

class KeycloakAdmin:
    def __init__(self, base: str, realm: str, admin: str, password: str):
        self.base  = base.rstrip("/")
        self.realm = realm
        self._token: str | None = None
        self._admin    = admin
        self._password = password
        self._role_cache: dict[str, str] = {}   # name → id

    def _auth(self) -> str:
        if self._token:
            return self._token
        r = requests.post(
            f"{self.base}/realms/master/protocol/openid-connect/token",
            data={
                "grant_type": "password",
                "client_id":  "admin-cli",
                "username":   self._admin,
                "password":   self._password,
            },
            timeout=10,
        )
        r.raise_for_status()
        self._token = r.json()["access_token"]
        return self._token

    def _h(self) -> dict:
        return {"Authorization": f"Bearer {self._auth()}", "Content-Type": "application/json"}

    def _url(self, path: str) -> str:
        return f"{self.base}/admin/realms/{self.realm}{path}"

    def existing_usernames(self) -> set[str]:
        r = requests.get(self._url("/users"), params={"max": 1000}, headers=self._h(), timeout=10)
        r.raise_for_status()
        return {u["username"] for u in r.json() if "username" in u}

    def find_user(self, username: str) -> dict | None:
        r = requests.get(
            self._url("/users"),
            params={"username": username, "exact": "true"},
            headers=self._h(),
            timeout=10,
        )
        r.raise_for_status()
        users = r.json()
        return users[0] if users else None

    def create_user(self, username: str, first_name: str, last_name: str,
                    medacap_username: str) -> str:
        payload: dict[str, Any] = {
            "username":   username,
            "firstName":  first_name,
            "lastName":   last_name,
            "enabled":    True,
            "attributes": {"medacap_username": [medacap_username]},
            "credentials": [{
                "type":      "password",
                "value":     _DEFAULT_PASSWORD,
                "temporary": _TEMPORARY_PASSWORD,
            }],
        }
        r = requests.post(self._url("/users"), json=payload, headers=self._h(), timeout=10)
        r.raise_for_status()
        location = r.headers.get("Location", "")
        user_id = location.rstrip("/").split("/")[-1]
        return user_id

    def update_user_attributes(self, user_id: str, medacap_username: str) -> None:
        r = requests.put(
            self._url(f"/users/{user_id}"),
            json={"attributes": {"medacap_username": [medacap_username]}},
            headers=self._h(),
            timeout=10,
        )
        r.raise_for_status()

    def get_realm_role(self, role_name: str) -> dict:
        if role_name in self._role_cache:
            return {"id": self._role_cache[role_name], "name": role_name}
        r = requests.get(self._url(f"/roles/{role_name}"), headers=self._h(), timeout=10)
        r.raise_for_status()
        role = r.json()
        self._role_cache[role_name] = role["id"]
        return role

    def assign_realm_role(self, user_id: str, role_name: str) -> None:
        role = self.get_realm_role(role_name)
        r = requests.post(
            self._url(f"/users/{user_id}/role-mappings/realm"),
            json=[role],
            headers=self._h(),
            timeout=10,
        )
        r.raise_for_status()

    def user_has_role(self, user_id: str, role_name: str) -> bool:
        r = requests.get(
            self._url(f"/users/{user_id}/role-mappings/realm"),
            headers=self._h(),
            timeout=10,
        )
        r.raise_for_status()
        return any(role["name"] == role_name for role in r.json())


# ── Commande principale ────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = "Import managers MEDACAP (profile=Manager) → Keycloak (team_manager) + MongoDB keycloakUsername"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Affiche le plan sans écrire en Keycloak ni en MongoDB",
        )
        parser.add_argument(
            "--subsidiary", default=None,
            help="Filtrer sur une filiale (ex : 'CAMEROON MOTORS INDUSTRIES')",
        )

    def handle(self, *args, **opts):
        dry = opts["dry_run"]
        subsidiary_filter = opts.get("subsidiary")

        db = _db()
        mongo_filter: dict = {"profile": "Manager"}
        if subsidiary_filter:
            mongo_filter["subsidiary"] = subsidiary_filter

        managers = list(db["users"].find(mongo_filter, {
            "username": 1, "firstName": 1, "lastName": 1,
            "subsidiary": 1, "agency": 1, "department": 1,
            "keycloakUsername": 1,
        }))

        self.stdout.write(f"Managers MEDACAP trouvés : {len(managers)}")
        if not managers:
            return

        if dry:
            self.stdout.write(self.style.WARNING("=== DRY RUN — aucune écriture ==="))

        # ── Init Keycloak ──────────────────────────────────────────────────────
        if not _KC_URL:
            self.stderr.write(self.style.ERROR(
                "KEYCLOAK_URL non défini — export KEYCLOAK_URL=http://localhost:8080"
            ))
            return

        kc = KeycloakAdmin(_KC_URL, _REALM, _KC_ADMIN, _KC_PW)

        try:
            existing_usernames = kc.existing_usernames()
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"Keycloak inaccessible : {exc}"))
            return

        # ── Traiter chaque manager ─────────────────────────────────────────────
        stats = {"created": 0, "updated": 0, "skipped": 0, "error": 0}
        generated_usernames: set[str] = set(existing_usernames)

        for doc in managers:
            medacap_username = doc.get("username") or ""
            first_name = (doc.get("firstName") or "").strip()
            last_name  = (doc.get("lastName") or "").strip()
            subsidiary = doc.get("subsidiary") or ""
            agency     = doc.get("agency") or ""

            if not first_name or not last_name:
                self.stdout.write(
                    self.style.WARNING(f"  SKIP {medacap_username!r} — prénom/nom manquant")
                )
                stats["skipped"] += 1
                continue

            # Username déjà mappé précédemment ?
            existing_kc_username = doc.get("keycloakUsername")

            # Générer un username normalisé si pas encore connu
            if existing_kc_username:
                kc_username = existing_kc_username
            else:
                base = normalize_username(first_name, last_name)
                kc_username = make_unique(base, generated_usernames)

            generated_usernames.add(kc_username)

            self.stdout.write(
                f"  {medacap_username!r:15s} → {kc_username:30s}  "
                f"({first_name} {last_name}, {agency} / {subsidiary})"
            )

            if dry:
                continue

            try:
                # Vérifier si le compte Keycloak existe déjà
                existing_user = kc.find_user(kc_username)

                if existing_user:
                    user_id = existing_user["id"]
                    # Mettre à jour l'attribut medacap_username si absent
                    attrs = existing_user.get("attributes") or {}
                    if "medacap_username" not in attrs:
                        kc.update_user_attributes(user_id, medacap_username)
                    action = "updated"
                else:
                    user_id = kc.create_user(kc_username, first_name, last_name, medacap_username)
                    action = "created"

                # Assigner le rôle team_manager si pas déjà fait
                if not kc.user_has_role(user_id, "team_manager"):
                    kc.assign_realm_role(user_id, "team_manager")

                # Écrire keycloakUsername dans MongoDB
                db["users"].update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"keycloakUsername": kc_username}},
                )

                stats[action] += 1
                self.stdout.write(f"    ✓ {action}")

            except Exception as exc:
                stats["error"] += 1
                self.stderr.write(self.style.ERROR(f"    ✗ {medacap_username!r}: {exc}"))

        self.stdout.write(self.style.SUCCESS(
            f"\nTerminé — créés: {stats['created']}  "
            f"mis à jour: {stats['updated']}  "
            f"ignorés: {stats['skipped']}  "
            f"erreurs: {stats['error']}"
        ))
