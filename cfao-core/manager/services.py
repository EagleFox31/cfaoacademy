"""Services MEDACAP pour le portail Chef d'équipe.

Lecture seule sur Mongo `academy`. La portée d'un manager = tous les
techniciens de sa filiale + même agence (scope agence) ; si aucun tech
n'est trouvé à cette agence, on remonte au scope filiale.

Source de vérité compétences : `technicianBrandScores`
  {userId, firstName, lastName, scores: {Junior:{BRAND:{averageFactuel, averageDeclaratif, averageTotal}}, …}}

Règle MEDACAP : le score effectif d'un tech sur une marque × niveau = MIN(factuel, déclaratif).
Un technicien ne peut pas être meilleur en pratique qu'en théorie déclarée, ni valoriser
une théorie non appliquée. `averageTotal` (moyenne des deux) n'est PAS utilisé.
"""
from __future__ import annotations

import logging
import re
import time
from functools import wraps
from typing import Callable, TypeVar

from pymongo.errors import PyMongoError

from analytics.services import _db  # réutilise le client Mongo partagé

log = logging.getLogger(__name__)

T = TypeVar("T")

TECHNICIAN_RE = re.compile(r"technicien", re.IGNORECASE)
BRAND_LEVEL_ORDER = ["Junior", "Senior", "Expert"]


def _ttl(seconds: int):
    def decorator(fn: Callable[..., T]) -> Callable[..., T]:
        cache: dict = {}

        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = (args, tuple(sorted(kwargs.items())))
            now = time.monotonic()
            hit = cache.get(key)
            if hit and (now - hit[0]) < seconds:
                return hit[1]
            value = fn(*args, **kwargs)
            cache[key] = (now, value)
            return value

        wrapper.cache_clear = cache.clear  # type: ignore[attr-defined]
        return wrapper

    return decorator


def _clean_brands(raw_list: list) -> list[str]:
    return sorted({b.strip() for b in (raw_list or []) if b and b.strip()})


def _score_color(avg: float | None) -> str:
    if avg is None:
        return "neutral"
    if avg >= 75:
        return "green"
    if avg >= 50:
        return "orange"
    return "red"


def _effective_score(data: dict) -> float | None:
    """Score MEDACAP effectif = MIN(factuel, déclaratif).

    Si l'un des deux manque, on retombe sur l'autre. Si les deux manquent, None.
    `averageTotal` (moyenne) est ignoré : ce n'est pas la règle métier.
    """
    fact = data.get("averageFactuel")
    decl = data.get("averageDeclaratif")
    if fact is None and decl is None:
        return None
    if fact is None:
        return float(decl)
    if decl is None:
        return float(fact)
    return float(min(fact, decl))


@_ttl(60)
def manager_scope(subsidiary: str, agency: str | None = None) -> dict:
    """Scope équipe d'un chef d'équipe.

    Retourne un dict sérialisable JSON utilisable directement par l'endpoint
    `/api/v1/core/manager/scope`.

    Champs :
        technicianCount, brandCount, agencyName, subsidiaryName,
        members: [{username, firstName, lastName, level, agency,
                   brands: [str], scores: {BRAND: {level: {avg, color}}}}]
        brandMatrix: [{brand, levels: {Junior/Senior/Expert: {avg, color, count}}}]
        kpis: {avgScore, scoredCount, totalCount, alertCount}
    """
    db = _db()

    # -- Récupérer les techniciens du scope ---------------------------------
    base_filter: dict = {
        "subsidiary": subsidiary,
        "profile": {"$regex": TECHNICIAN_RE.pattern, "$options": "i"},
    }
    agency_filter = {**base_filter, "agency": agency} if agency else None

    def _fetch_team(query: dict) -> list[dict]:
        return list(
            db["users"].find(
                query,
                {
                    "_id": 1,
                    "username": 1,
                    "firstName": 1,
                    "lastName": 1,
                    "level": 1,
                    "agency": 1,
                    "department": 1,
                    "brandJunior": 1,
                    "brandSenior": 1,
                    "brandExpert": 1,
                },
            )
        )

    team = _fetch_team(agency_filter) if agency_filter else []
    scope_label = agency or subsidiary
    if len(team) < 2:
        # Pas assez de monde à l'agence → scope filiale
        team = _fetch_team(base_filter)
        scope_label = subsidiary

    team_ids = [u["_id"] for u in team]

    # -- Scores par marque (technicianBrandScores) ---------------------------
    try:
        brand_scores_raw = {
            s["userId"]: s
            for s in db["technicianBrandScores"].find({"userId": {"$in": team_ids}})
        }
    except PyMongoError as exc:
        log.warning("manager.scope.brand_scores failed err=%s", exc)
        brand_scores_raw = {}

    # -- Construire la liste membres ----------------------------------------
    members: list[dict] = []
    all_brands: set[str] = set()
    brand_level_data: dict[str, dict[str, list[float]]] = {}

    for u in team:
        raw_brands = (
            _clean_brands(u.get("brandJunior", []))
            + _clean_brands(u.get("brandSenior", []))
            + _clean_brands(u.get("brandExpert", []))
        )
        user_brands = list(dict.fromkeys(raw_brands))  # dedup preserving first occurrence
        all_brands.update(user_brands)

        score_doc = brand_scores_raw.get(u["_id"])
        member_scores: dict[str, dict] = {}
        if score_doc:
            for level in BRAND_LEVEL_ORDER:
                for brand, data in (score_doc.get("scores", {}).get(level) or {}).items():
                    avg = _effective_score(data)
                    if avg is None:
                        continue
                    if brand not in member_scores:
                        member_scores[brand] = {}
                    member_scores[brand][level] = {
                        "avg": round(avg, 1),
                        "color": _score_color(avg),
                    }
                    # aggregate for matrix
                    if brand not in brand_level_data:
                        brand_level_data[brand] = {l: [] for l in BRAND_LEVEL_ORDER}
                    brand_level_data[brand][level].append(avg)

        members.append(
            {
                "username": u.get("username", ""),
                "firstName": u.get("firstName", ""),
                "lastName": u.get("lastName", ""),
                "level": u.get("level") or "—",
                "agency": u.get("agency") or "",
                "department": u.get("department") or "",
                "brands": user_brands,
                "scores": member_scores,
                "hasScores": bool(member_scores),
            }
        )

    # Sort: techs with scores first, then by name
    members.sort(key=lambda m: (0 if m["hasScores"] else 1, m["lastName"]))

    # -- Brand matrix (agrégat équipe) -------------------------------------
    brand_matrix: list[dict] = []
    for brand in sorted(brand_level_data.keys()):
        entry: dict = {"brand": brand, "levels": {}}
        for level in BRAND_LEVEL_ORDER:
            vals = brand_level_data[brand].get(level, [])
            if vals:
                avg = sum(vals) / len(vals)
                entry["levels"][level] = {
                    "avg": round(avg, 1),
                    "color": _score_color(avg),
                    "count": len(vals),
                }
        brand_matrix.append(entry)

    # -- KPIs globaux -------------------------------------------------------
    all_scores = [
        data["avg"]
        for m in members
        for brand_data in m["scores"].values()
        for level_data in brand_data.values()
        for data in [level_data]
        if "avg" in data
    ]
    avg_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else None
    scored_count = sum(1 for m in members if m["hasScores"])
    # Alert = technicien sans aucun score ET brands assignés
    alert_count = sum(1 for m in members if not m["hasScores"] and m["brands"])

    return {
        "subsidiary": subsidiary,
        "agencyName": scope_label,
        "technicianCount": len(members),
        "brandCount": len(all_brands),
        "members": members,
        "brandMatrix": brand_matrix,
        "kpis": {
            "avgScore": avg_score,
            "scoredCount": scored_count,
            "totalCount": len(members),
            "alertCount": alert_count,
        },
    }
