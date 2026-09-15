"""Seed dev : arbre org + marques + 9 personas + affectations, alignés sur le realm Keycloak.

Idempotent. Les `keycloak_sub` sont des UUID FIXES, identiques aux `id` des users du realm
(keycloak/config/cfao-realm.yaml) → /me résout le périmètre depuis la base pour ces comptes.
"""
import os

import requests
from django.core.management.base import BaseCommand
from django.db import transaction

from identity.models import Brand, OrgUnit, RoleAssignment, User

SUB = lambda n: f"11111111-1111-1111-1111-{n:012d}"  # noqa: E731  (fallback si Keycloak injoignable)

_KC = os.environ.get("KEYCLOAK_URL", "")
_KC_ADMIN = os.environ.get("KEYCLOAK_ADMIN", "admin")
_KC_PW = os.environ.get("KEYCLOAK_ADMIN_PASSWORD", "admin")
_REALM = os.environ.get("OIDC_REALM", "cfao")


_KC_USER_MAP = None  # username → sub, récupéré en UN seul appel (fiable, pas de flakiness par user)


def _kc_user_map():
    global _KC_USER_MAP
    if _KC_USER_MAP is not None:
        return _KC_USER_MAP
    _KC_USER_MAP = {}
    if not _KC:
        return _KC_USER_MAP
    try:
        tok = requests.post(
            f"{_KC}/realms/master/protocol/openid-connect/token",
            data={"grant_type": "password", "client_id": "admin-cli", "username": _KC_ADMIN, "password": _KC_PW},
            timeout=8,
        ).json().get("access_token")
        if not tok:
            return _KC_USER_MAP
        users = requests.get(
            f"{_KC}/admin/realms/{_REALM}/users",
            params={"max": 200}, headers={"Authorization": f"Bearer {tok}"}, timeout=8,
        ).json()
        _KC_USER_MAP = {u["username"]: u["id"] for u in users if "username" in u and "id" in u}
    except (requests.RequestException, KeyError, ValueError):
        pass
    return _KC_USER_MAP


def keycloak_sub(username):
    """Vrai `sub` Keycloak par username (depuis la map récupérée en un appel). None sinon."""
    return _kc_user_map().get(username)

BRANDS = [
    ("toyota", "Toyota", "vl"), ("suzuki", "Suzuki", "vl"),
    ("fuso", "Fuso", "pl"), ("renault-trucks", "Renault Trucks", "pl"),
    ("king-long", "King Long", "bus"), ("jcb", "JCB", "engins"), ("lovol", "Lovol", "engins"),
]

# (kind, slug, parent_slug_path)
TREE = [
    ("group", "groupe", None),
    ("region", "afrique_ouest", "groupe"),
    ("region", "afrique_nord", "groupe"),
    ("region", "afrique_centrale", "groupe"),
    ("branch", "cote_divoire", "groupe.afrique_ouest"),
    ("agency", "abidjan_plateau", "groupe.afrique_ouest.cote_divoire"),
    ("branch", "senegal", "groupe.afrique_ouest"),
    ("agency", "dakar_nord", "groupe.afrique_ouest.senegal"),
    ("branch", "maroc", "groupe.afrique_nord"),
    ("agency", "casablanca", "groupe.afrique_nord.maroc"),
    ("branch", "cameroun", "groupe.afrique_centrale"),
    ("agency", "douala", "groupe.afrique_centrale.cameroun"),
]

# username, sub#, email, prénom, nom, [(role, scope_code, [brands])]
PERSONAS = [
    ("kouame.assi", 1, "kouame.assi@cfao.example", "Kouamé", "Assi",
     [("learner", "groupe.afrique_ouest.cote_divoire.abidjan_plateau", ["toyota"])]),
    ("brahim.tahir", 2, "brahim.tahir@cfao.example", "Brahim", "Tahir",
     [("learner", "groupe.afrique_nord.maroc.casablanca", ["toyota"]),
      ("ki", "groupe.afrique_nord.maroc.casablanca", ["toyota"])]),
    ("moa.pilotage", 3, "moa@cfao.example", "MOA", "Pilotage",
     [("group_admin", "groupe", [])]),
    ("tech.lead", 4, "techlead@cfao.example", "Tech", "Lead",
     [("build_team", "groupe", [])]),
    ("admin.groupe", 5, "admin@cfao.example", "Admin", "Groupe",
     [("superadmin", "groupe", [])]),
    ("seydou.diallo", 6, "seydou.diallo@cfao.example", "Seydou", "Diallo",
     [("team_manager", "groupe.afrique_ouest.senegal.dakar_nord", ["toyota", "suzuki"])]),
    ("fatou.mbaye", 7, "fatou.mbaye@cfao.example", "Fatou", "Mbaye",
     [("workshop_manager", "groupe.afrique_ouest.senegal.dakar_nord", ["toyota", "suzuki", "fuso"])]),
    ("aminata.kone", 8, "aminata.kone@cfao.example", "Aminata", "Koné",
     [("branch_hr", "groupe.afrique_ouest.cote_divoire", [])]),
    ("loic.traore", 9, "loic.traore@cfao.example", "Loïc", "Traoré",
     [("learner", "groupe.afrique_centrale.cameroun.douala",
       ["fuso", "renault-trucks", "king-long", "jcb", "lovol"])]),
]


class Command(BaseCommand):
    help = "Seed des données de dev (org, marques, personas, affectations)."

    @transaction.atomic
    def handle(self, *args, **opts):
        # Reset des données de domaine (dev) → idempotent quel que soit le sub.
        RoleAssignment.objects.all().delete()
        User.objects.all().delete()
        OrgUnit.objects.all().delete()
        Brand.objects.all().delete()

        brands = {}
        for code, name, cat in BRANDS:
            brands[code], _ = Brand.objects.get_or_create(code=code, defaults={"name": name, "category": cat})

        units = {}
        for kind, slug, parent_code in TREE:
            parent = units.get(parent_code)
            code = f"{parent.code}.{slug}" if parent else slug
            unit = OrgUnit.objects.filter(code=code).first()
            if not unit:
                unit = OrgUnit.objects.create(
                    kind=kind, slug=slug, name=slug.replace("_", " ").title(), parent=parent,
                )
            units[code] = unit

        for username, n, email, fn, ln, assigns in PERSONAS:
            sub = keycloak_sub(username) or SUB(n)  # vrai sub Keycloak, sinon fallback fixe
            user, _ = User.objects.get_or_create(
                keycloak_sub=sub, defaults={"email": email, "first_name": fn, "last_name": ln},
            )
            for role, scope_code, brand_codes in assigns:
                ra, _ = RoleAssignment.objects.get_or_create(
                    user=user, role=role, scope_unit=units[scope_code],
                )
                ra.brands.set([brands[c] for c in brand_codes])
            user.recompute_scope_paths()

        self.stdout.write(self.style.SUCCESS(
            f"Seed OK : {OrgUnit.objects.count()} unités, {Brand.objects.count()} marques, "
            f"{User.objects.count()} users, {RoleAssignment.objects.count()} affectations."
        ))
