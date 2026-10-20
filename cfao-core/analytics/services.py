"""Services d'agrégation MEDACAP → KPIs consolidés pour le portail Super Admin.

Lecture seule sur Mongo `academy` (source de vérité de la mesure des compétences).
Les fonctions renvoient des int purs, jamais None, pour ne jamais faire trébucher
le hero du portail (une phrase avec un trou est pire qu'un chiffre à 0).

Voir docs/medacap-competency-model.md pour le modèle de données.
"""
from __future__ import annotations

import logging
import re
import time
from functools import lru_cache, wraps
from typing import Callable, TypeVar

import requests
from django.conf import settings
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from .brand_classification import EQUIPMENT_BRANDS, MOTORS_BRANDS, bu_brands
from .subsidiary_classification import resolve_subsidiary

log = logging.getLogger(__name__)

T = TypeVar("T")


def ttl_cache(ttl_seconds: int) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Cache en mémoire par arguments avec expiration.

    Chaque appel avec la même signature d'arguments est mémorisé pendant
    `ttl_seconds`. Passé ce délai, la valeur est recalculée à la prochaine
    demande. Thread-safe suffisant pour Django : sur runserver/gunicorn on
    a un cache par worker — c'est intentionnel (pas de coordination inter-process).

    Le hero super admin recalcule tous les KPIs à chaque render — le cache
    évite d'attaquer Mongo + cfao-needs à chaque coup.
    """
    def decorator(fn: Callable[..., T]) -> Callable[..., T]:
        cache: dict[tuple, tuple[float, T]] = {}

        @wraps(fn)
        def wrapper(*args, **kwargs) -> T:
            key = (args, tuple(sorted(kwargs.items())))
            now = time.monotonic()
            hit = cache.get(key)
            if hit is not None and (now - hit[0]) < ttl_seconds:
                return hit[1]
            value = fn(*args, **kwargs)
            cache[key] = (now, value)
            return value

        wrapper.cache_clear = cache.clear  # type: ignore[attr-defined]
        return wrapper

    return decorator

TECHNICIAN_PROFILE_REGEX = re.compile(r"technicien", re.IGNORECASE)

# Business Units acceptées côté API. `all` = pas de filtre.
BU_ALL = "all"
BU_EQUIPMENT = "equipment"
BU_MOTORS = "motors"
VALID_BUS = {BU_ALL, BU_EQUIPMENT, BU_MOTORS}


def _bu_filter(bu: str) -> dict:
    """Filtre Mongo par Business Unit sur `users.department`.

    Le champ MEDACAP `department` prend les valeurs `Motors`, `Equipment`, ou
    combos (`Equipment & Motors`, `Equipment, Motors`) — pas d'énumération
    stricte côté source. On matche par regex insensible à la casse et à la
    ponctuation ; un technicien multi-BU compte dans les deux buckets, ce qui
    est le comportement métier attendu.
    """
    if bu == BU_EQUIPMENT:
        return {"department": {"$regex": r"equipment", "$options": "i"}}
    if bu == BU_MOTORS:
        return {"department": {"$regex": r"motors", "$options": "i"}}
    return {}


def _match_technician(bu: str = BU_ALL) -> dict:
    """Construit le `$match` combiné profile=Technicien + filtre BU."""
    base = {"profile": {"$regex": TECHNICIAN_PROFILE_REGEX.pattern, "$options": "i"}}
    bu_extra = _bu_filter(bu)
    return {**base, **bu_extra} if bu_extra else base


@lru_cache(maxsize=1)
def _get_client() -> MongoClient:
    """Client Mongo réutilisé (thread-safe). Timeout court pour ne jamais bloquer
    l'API si Mongo est indisponible — mieux vaut renvoyer 0 que faire attendre.
    """
    return MongoClient(
        settings.MEDACAP_MONGO_URI,
        serverSelectionTimeoutMS=1500,
        connectTimeoutMS=1500,
        socketTimeoutMS=2000,
    )


def _db():
    return _get_client()[settings.MEDACAP_MONGO_DB]


def _normalize_brand(raw: str) -> str | None:
    """Normalise un libellé marque MEDACAP.

    Les mêmes marques apparaissent avec des variantes (casse, espaces, typos) :
    " TOYOTA FORKLIFT" / "TOYOTA FORKLIFT" / "Toyota Forklift" → toutes = TOYOTA FORKLIFT
    SINOTRUK / SINOTRUCK → TOYOTA-like typo, on garde SINOTRUK
    MUTSIBUSHI / MITSUBISHI → typo → MITSUBISHI
    """
    if not raw or not isinstance(raw, str):
        return None
    b = raw.strip().upper()
    if not b:
        return None
    # Correction typos observés en base
    fixes = {
        "SINOTRUCK": "SINOTRUK",
        "MUTSIBUSHI": "MITSUBISHI",
    }
    return fixes.get(b, b)


def _safe_count(coll_name: str, query: dict | None = None) -> int:
    try:
        return int(_db()[coll_name].count_documents(query or {}))
    except PyMongoError as exc:
        log.warning("analytics.mongo.count failed coll=%s err=%s", coll_name, exc)
        return 0


@ttl_cache(60)
def count_technicians(bu: str = BU_ALL) -> int:
    """Nombre de techniciens par BU, source : Clé de Répartition via cfao-needs.

    Utilise campaigns_branchbrandquota (total_branch_techs distinct par pays)
    plutôt que MEDACAP Mongo : MEDACAP ne contient que les techniciens évalués,
    pas l'ensemble des effectifs déclarés par les filiales.

    Fail-open → 0 si cfao-needs down / mal configuré.
    """
    if bu not in VALID_BUS:
        bu = BU_ALL

    key = getattr(settings, "NEEDS_ANALYTICS_KEY", "") or ""
    base = getattr(settings, "NEEDS_API_URL", "") or ""
    if not key or not base:
        log.warning("analytics.needs.total_technicians misconfigured: NEEDS_API_URL / KEY manquants")
        return 0

    from datetime import date
    year = date.today().year
    url = f"{base.rstrip('/')}/api/v1/needs/analytics/total-technicians"
    try:
        res = requests.get(
            url,
            params={"bu": bu, "year": year},
            headers={"X-Analytics-Key": key, "Accept": "application/json"},
            timeout=3.5,
        )
        if res.status_code != 200:
            log.warning("analytics.needs.total_technicians http=%s bu=%s", res.status_code, bu)
            return 0
        return int(res.json().get("count", 0))
    except (requests.RequestException, ValueError) as exc:
        log.warning("analytics.needs.total_technicians failed bu=%s err=%s", bu, exc)
        return 0


@ttl_cache(60)
def count_subsidiaries() -> int:
    """Nombre de filiales enregistrées (non filtrable par BU : une filiale
    peut opérer les deux pôles, on ne compte pas de « filiale Equipment » vs
    « filiale Motors » distinctes)."""
    return _safe_count("subsidiaries")


@ttl_cache(60)
def filiales_learners() -> list[dict]:
    """Compteurs learners par filiale × Business Unit.

    Renvoie une liste :
        [
          {
            "displayName": "Cameroun",
            "countryCode": "cm",
            "all":         68,
            "motors":      6,
            "equipment":   62
          },
          ...
        ]

    Comptage :
    - `equipment` = techs avec `department ~ /equipment/i` (inclut « Equipment
      & Motors »).
    - `motors` = techs avec `department ~ /motors/i` (inclut mixtes).
    - `all` = total distinct — un tech mixte compte 1 fois dans `all` mais 1
      fois dans `motors` ET 1 fois dans `equipment`. Donc `motors + equipment
      >= all` (les mixtes sont dédupliqués côté `all`).

    Les subsidiaries MEDACAP non mappées dans `subsidiary_classification` sont
    ignorées silencieusement (data invalide, subsidiary vide, ...). La filiale
    `CFR` est rattachée au Cameroun (cf. mapping).
    """
    try:
        pipeline = [
            {"$match": {"profile": {"$regex": TECHNICIAN_PROFILE_REGEX.pattern, "$options": "i"}}},
            {"$group": {
                "_id": "$subsidiary",
                "all":       {"$sum": 1},
                "equipment": {"$sum": {"$cond": [{"$regexMatch": {"input": {"$ifNull": ["$department", ""]}, "regex": "equipment", "options": "i"}}, 1, 0]}},
                "motors":    {"$sum": {"$cond": [{"$regexMatch": {"input": {"$ifNull": ["$department", ""]}, "regex": "motors",    "options": "i"}}, 1, 0]}},
            }},
        ]
        raw = _db()["users"].aggregate(pipeline)
    except PyMongoError as exc:
        log.warning("analytics.mongo.filiales_learners failed err=%s", exc)
        return []

    # Agréger par displayName : les rows CFR + CAMEROON MOTORS INDUSTRIES doivent
    # fusionner sur Cameroun (voir mapping).
    aggregated: dict[str, dict] = {}
    for doc in raw:
        info = resolve_subsidiary(doc.get("_id"))
        if info is None:
            continue
        key = info["displayName"]
        bucket = aggregated.setdefault(key, {
            "displayName": info["displayName"],
            "countryCode": info["countryCode"],
            "all": 0,
            "motors": 0,
            "equipment": 0,
        })
        bucket["all"]       += int(doc.get("all", 0))
        bucket["motors"]    += int(doc.get("motors", 0))
        bucket["equipment"] += int(doc.get("equipment", 0))

    # Ordre décroissant sur `all` — le plus gros effectif en tête.
    return sorted(aggregated.values(), key=lambda x: x["all"], reverse=True)


@ttl_cache(60)
def count_distinct_brands(bu: str = BU_ALL) -> int:
    """Nombre de marques partenaires pilotées, filtré par Business Unit.

    Trois cas :

    - `bu == 'equipment'` / `bu == 'motors'` → renvoie `len(canonical)`. On expose
      le **catalogue partenaires** (chiffre stable, aligné front) plutôt que
      l'observation MEDACAP : le hero dit « vous pilotez N marques », un chiffre
      qui doit refléter la couverture stratégique et pas fluctuer parce qu'un
      technicien a été créé ce matin.

    - `bu == 'all'` → union `Equipment ∪ Motors`, avec intersection MEDACAP.
      C'est le cas où on veut mesurer la couverture réelle des deux catalogues
      dans la base actuelle : si aucun tech ne porte SHACMAN, on ne l'affiche
      pas dans le total.

    Historique : cette fonction a été réécrite plusieurs fois. Version 1
    comptait uniquement l'observed MEDACAP normalisé (18 en tout, mais 15/17
    en split BU à cause des techs `Equipment & Motors`). Version 2 intersectait
    observed × canonical (10/8/18). Version 3 (actuelle) découple `all`
    (observed ∩ canonical) de `equipment/motors` (len canonical). Voir
    `PLAN_superadmin_kpis_reels_2026-09-24.md` §Item 1.
    """
    canon = bu_brands(bu)
    if canon is not None:
        # BU spécifiée : chiffre stable = taille du catalogue partenaires.
        return len(canon)

    # bu == 'all' : union des deux catalogues, intersecté avec MEDACAP observé.
    canonical_union = EQUIPMENT_BRANDS | MOTORS_BRANDS
    try:
        pipeline = [
            {"$match": _match_technician(BU_ALL)},
            {"$project": {
                "brands": {"$setUnion": [
                    {"$ifNull": ["$brandJunior", []]},
                    {"$ifNull": ["$brandSenior", []]},
                    {"$ifNull": ["$brandExpert", []]},
                ]},
            }},
            {"$unwind": "$brands"},
        ]
        raw = _db()["users"].aggregate(pipeline)
        observed = set()
        for doc in raw:
            normalized = _normalize_brand(doc.get("brands"))
            if normalized:
                observed.add(normalized)
        return len(observed & canonical_union)
    except PyMongoError as exc:
        log.warning("analytics.mongo.distinct_brands failed err=%s", exc)
        return 0


@ttl_cache(60)
def fetch_allocations_per_branch(year: int | None = None) -> list[dict]:
    """Places allouées par filiale pour l'année (source cfao-needs).

    HTTP → `GET /api/v1/needs/analytics/allocations-per-branch?year=YYYY`.
    Renvoie une liste `[{country, seats}, ...]` triée décroissant par seats,
    ou `[]` si cfao-needs est down / mal configuré (fail-open).

    Cache 60 s. À chaque render du hero, on ne repart pas au réseau.
    """
    if year is None:
        from datetime import date
        year = date.today().year

    key = getattr(settings, "NEEDS_ANALYTICS_KEY", "") or ""
    base = getattr(settings, "NEEDS_API_URL", "") or ""
    if not key or not base:
        log.warning("analytics.needs.allocations misconfigured: NEEDS_API_URL / KEY manquants")
        return []

    url = f"{base.rstrip('/')}/api/v1/needs/analytics/allocations-per-branch"
    try:
        res = requests.get(
            url,
            params={"year": year},
            headers={"X-Analytics-Key": key, "Accept": "application/json"},
            timeout=3.5,
        )
        if res.status_code != 200:
            log.warning("analytics.needs.allocations http=%s year=%s", res.status_code, year)
            return []
        payload = res.json()
        raw = payload.get("allocations", [])
        return [
            {"country": str(row.get("country", "")), "seats": int(row.get("seats", 0))}
            for row in raw
        ]
    except (requests.RequestException, ValueError) as exc:
        log.warning("analytics.needs.allocations failed year=%s err=%s", year, exc)
        return []


@ttl_cache(60)
def count_scheduled_trainings(year: int | None = None) -> int:
    """Nombre de sessions de formation programmées pour l'année donnée.

    Source : **cfao-needs** — endpoint `GET /api/v1/needs/analytics/scheduled-trainings`
    (service détachable, app 16). On appelle en HTTP avec header `X-Analytics-Key`
    plutôt que taper la DB directement, ce qui respecte la frontière de service :
    changer le schéma Postgres côté needs ne casse plus cfao-core tant que le
    contrat JSON tient.

    Renvoyer 0 est un signal métier légitime (« rien programmé pour 2027 encore »)
    — ne jamais mocker ce chiffre. Fail-open : retour 0 si cfao-needs down / 401 /
    timeout. Cache 60 s : à chaque render du hero on ne repart pas au réseau.
    """
    if year is None:
        from datetime import date
        year = date.today().year

    key = getattr(settings, "NEEDS_ANALYTICS_KEY", "") or ""
    base = getattr(settings, "NEEDS_API_URL", "") or ""
    if not key or not base:
        log.warning("analytics.needs.scheduled_trainings misconfigured: NEEDS_API_URL / NEEDS_ANALYTICS_KEY manquants")
        return 0

    url = f"{base.rstrip('/')}/api/v1/needs/analytics/scheduled-trainings"
    try:
        res = requests.get(
            url,
            params={"year": year},
            headers={"X-Analytics-Key": key, "Accept": "application/json"},
            timeout=3.5,
        )
        if res.status_code != 200:
            log.warning("analytics.needs.scheduled_trainings http=%s year=%s", res.status_code, year)
            return 0
        payload = res.json()
        return int(payload.get("count", 0))
    except (requests.RequestException, ValueError) as exc:
        log.warning("analytics.needs.scheduled_trainings failed year=%s err=%s", year, exc)
        return 0


def group_stats(bu: str = BU_ALL) -> dict:
    """Snapshot des KPIs groupe pour le hero du portail Super Admin.

    `bu` filtre `learnerCount` et `brandCount` par Business Unit (Equipment /
    Motors / all). `branchCount` et `trainingCount` restent globaux : une
    filiale opère souvent les deux pôles, et les formations sont programmées
    au niveau catalogue groupe.

    Renvoie systématiquement les mêmes clés — même à 0 si Mongo est down
    (fail-open côté UI).
    """
    from datetime import date
    if bu not in VALID_BUS:
        bu = BU_ALL
    current_year = date.today().year
    return {
        "bu":            bu,
        "learnerCount":  count_technicians(bu),
        "branchCount":   count_subsidiaries(),
        "brandCount":    count_distinct_brands(bu),
        "trainingCount": count_scheduled_trainings(current_year),
        "trainingYear":  current_year,
        # Breakdown par filiale (indépendant de `bu` : le front reçoit les 3
        # colonnes `all/motors/equipment` en un seul appel).
        "filiales":      filiales_learners(),
        # Places allouées par pays pour l'année en cours (cfao-needs). Item 4.
        "allocationsPerBranch": fetch_allocations_per_branch(current_year),
    }
