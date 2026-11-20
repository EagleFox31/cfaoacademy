"""Sessions à documenter, lues par le module Comptes rendus (contrat `cr-sessions`).

Le planning fait foi pour les sessions ; le module Comptes rendus en garde une
copie locale et la rafraîchit par GET conditionnel (ETag). Une session est « à
documenter » quand elle s'est terminée dans les `days` derniers jours, aujourd'hui
compris : un compte rendu se rédige après la session, alors que `me/sessions`
ne renvoie que les sessions à venir.

Source : le prévisionnel (`PlannedSession`), comme `me/sessions`. Une session sans
date de début est ignorée ; sans date de fin, elle dure un jour.

Chaque session porte une `revision` (empreinte de son contenu) : le consommateur
ne réécrit que les sessions dont la révision change. La `revision` de la réponse
couvre toute la liste et sert d'ETag.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json

from django.db.models import Q

from ..contract_cr import DEFAULT_DAYS, MAX_DAYS
from ..models import PlannedSession
from .trainer_load import working_days


def _today() -> dt.date:
    return dt.date.today()


class InvalidQuery(ValueError):
    """Paramètre de lecture refusé (le message est renvoyé tel quel)."""


def parse_days(raw: str | None) -> int:
    if raw in (None, ""):
        return DEFAULT_DAYS
    try:
        days = int(raw)
    except (TypeError, ValueError):
        raise InvalidQuery("days doit être un entier") from None
    if not 1 <= days <= MAX_DAYS:
        raise InvalidQuery(f"days doit être compris entre 1 et {MAX_DAYS}")
    return days


def _digest(value) -> str:
    raw = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:20]


def _trainer_json(t) -> dict:
    return {
        "id": str(t.pk),
        "name": t.full_name,
        "kind": t.kind,
        "is_external": t.is_external,
        "sub": t.keycloak_sub or None,
    }


def _session_json(s: PlannedSession) -> dict:
    end = s.end_date or s.start_date
    body = {
        "id": str(s.pk),
        "year": s.cost_key.year,
        "code": s.code_raw or s.code_norm,
        "code_norm": s.code_norm,
        "title": s.title,
        "brand": {"code": s.brand.code, "label": s.brand.label},
        "pole": s.cost_key.pole,
        "country": {"code": s.country.code, "label": s.country.label},
        "location": s.location,
        "delivery_mode": s.delivery_mode,
        "start_date": s.start_date.isoformat(),
        "end_date": end.isoformat(),
        "days": working_days(s.start_date, end),
        "trainers": [_trainer_json(t) for t in sorted(s.trainers.all(), key=lambda t: t.full_name)],
    }
    return {**body, "revision": _digest(body)}


def sessions_to_document(days: int = DEFAULT_DAYS, trainer_sub: str | None = None,
                         today: dt.date | None = None) -> dict:
    """Sessions terminées entre `today - days` et `today` inclus, par date de fin.

    `trainer_sub` (compte Keycloak) restreint aux sessions de ce formateur ; un
    compte relié à aucune fiche donne une liste vide, jamais une erreur.
    """
    today = today or _today()
    since = today - dt.timedelta(days=days)
    ended = (Q(end_date__gte=since, end_date__lte=today)
             | Q(end_date__isnull=True, start_date__gte=since, start_date__lte=today))
    qs = (PlannedSession.objects.filter(ended, start_date__isnull=False)
          .select_related("brand", "country", "cost_key")
          .prefetch_related("trainers"))
    if trainer_sub:
        qs = qs.filter(trainers__keycloak_sub=trainer_sub).distinct()
    sessions = sorted((_session_json(s) for s in qs), key=lambda s: (s["end_date"], s["code"], s["id"]))
    window = {"ended_from": since.isoformat(), "ended_to": today.isoformat()}
    return {
        "revision": _digest({"window": window, "sessions": [(s["id"], s["revision"]) for s in sessions]}),
        "window": window,
        "sessions": sessions,
    }
