"""Fiches formateurs ↔ comptes du realm commun.

- `link_trainer_account` : à chaque connexion d'un compte `trainer`, pose
  `Trainer.keycloak_sub` (et l'email s'il manque) sur la fiche qui lui correspond.
  Automatique, idempotent et rétroactif : un compte existant est relié à sa
  prochaine connexion. Jamais d'écrasement : une fiche déjà reliée ne change pas,
  un compte déjà relié n'est pas relié deux fois. Le lien n'est posé que si une
  seule fiche correspond (pas de flou, voir `TrainerAlias`).
- `account_profiles` : comptes à créer pour les fiches qui n'en ont pas, au format
  des profils locaux lu par `keycloak/migration/migrer_comptes.py` (l'identifiant
  du compte = celui de la fiche, ce qui pose le lien dès la première connexion).
"""
from __future__ import annotations

import logging
import uuid

from django.core.cache import cache
from django.db.models import Q

from .models import Trainer, TrainerAlias
from .normalize import norm_key, strip_accents

logger = logging.getLogger(__name__)

TRAINER_ROLE = "trainer"
ACADEMY_SCOPE = "CMR"  # code pays des formateurs de l'Academy (Douala)
ACADEMY_SCOPE_NODE = "groupe.cmr"  # son scopeNode Keycloak, au format orgPath de la plateforme
_LINKED_TTL = 24 * 3600
_UNMATCHED_TTL = 600


def _name_keys(claims: dict) -> set[str]:
    given, family = claims.get("given_name") or "", claims.get("family_name") or ""
    raw = [f"{given} {family}", f"{family} {given}", claims.get("name") or ""]
    username = (claims.get("preferred_username") or "").split("@")[0]
    raw.append(username)
    return {k for k in (norm_key(r) for r in raw) if k}


def _match(sub: str, claims: dict) -> Trainer | None:
    free = Trainer.objects.filter(Q(keycloak_sub__isnull=True) | Q(keycloak_sub=""))
    # 1. Compte créé depuis la fiche : même identifiant.
    by_id = free.filter(pk=sub).first() if _is_uuid(sub) else None
    if by_id:
        return by_id
    # 2. Email, puis nom ou alias : une seule fiche, sinon rien.
    email = (claims.get("email") or "").strip()
    if email:
        found = list(free.filter(email__iexact=email)[:2])
        if len(found) == 1:
            return found[0]
    keys = _name_keys(claims)
    if not keys:
        return None
    ids = set(free.filter(name_norm__in=keys).values_list("pk", flat=True))
    ids |= set(TrainerAlias.objects.filter(alias_norm__in=keys, trainer__in=free)
               .values_list("trainer_id", flat=True))
    return free.get(pk=ids.pop()) if len(ids) == 1 else None


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(str(value))
    except ValueError:
        return False
    return True


def link_trainer_account(sub: str, claims: dict, roles) -> Trainer | None:
    """Relie le compte connecté à sa fiche formateur. Sans effet hors rôle `trainer`."""
    if TRAINER_ROLE not in (roles or []) or not sub:
        return None
    key = f"planning:trainer-link:{sub}"
    if cache.get(key):
        return None
    if Trainer.objects.filter(keycloak_sub=sub).exists():
        cache.set(key, True, _LINKED_TTL)
        return None
    trainer = _match(sub, claims)
    if trainer is None:
        cache.set(key, True, _UNMATCHED_TTL)
        return None
    email = (claims.get("email") or "").strip() or None
    fields = {"keycloak_sub": sub}
    if email and not trainer.email and not Trainer.objects.filter(email__iexact=email).exists():
        fields["email"] = email
    # Mise à jour conditionnelle : deux connexions simultanées ne relient pas deux fois.
    done = (Trainer.objects.filter(pk=trainer.pk)
            .filter(Q(keycloak_sub__isnull=True) | Q(keycloak_sub="")).update(**fields))
    cache.set(key, True, _LINKED_TTL)
    if done:
        logger.info("Fiche formateur %s reliée à son compte.", trainer.pk)
        return trainer
    return None


def _username(full_name: str) -> str:
    return ".".join(strip_accents(full_name).lower().split()).replace("'", "")


def account_profiles(existing: list[dict] | None = None) -> list[dict]:
    """Comptes à créer : formateurs actifs (ni externes, ni techniciens instructeurs)
    sans compte relié, hors ceux déjà couverts par `existing` (profils locaux des
    comptes rendus, comparés par nom)."""
    covered = set()
    for p in existing or []:
        first, last = p.get("firstName") or "", p.get("lastName") or ""
        covered |= {norm_key(f"{first} {last}"), norm_key(f"{last} {first}")}
    trainers = (Trainer.objects
                .filter(kind=Trainer.Kind.TRAINER, is_active=True, is_external=False)
                .filter(Q(keycloak_sub__isnull=True) | Q(keycloak_sub=""))
                .select_related("home_country").prefetch_related("brands", "aliases"))
    profiles = []
    for t in trainers:
        names = {t.name_norm} | {a.alias_norm for a in t.aliases.all()}
        if names & covered:
            continue
        first, _, last = t.full_name.strip().partition(" ")
        profiles.append({
            "id": str(t.pk), "identifiant": _username(t.full_name),
            "firstName": first, "lastName": last or first,
            "roles": [TRAINER_ROLE], "scopeNodes": [_scope_node(t.home_country)],
            "brands": sorted(b.code for b in t.brands.all()), "departments": [],
        })
    return profiles


def _scope_node(country) -> str:
    """scopeNode du pays (dernier maillon de son orgPath) : jamais un code nu, que
    la condition Cerbos `scopeNode ∈ orgPath` ne reconnaîtrait pas."""
    if country is None:
        return ACADEMY_SCOPE_NODE
    if country.org_path:
        return country.org_path[-1]
    return f"groupe.{country.code.lower()}"
