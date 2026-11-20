"""Lien calculé entre le prévisionnel et le réalisé (SPEC §8 « Prévu et réalisé »).

Rien n'est stocké : les sessions se comptent par groupe (marque, code, pays hôte)
sur l'année et le pôle de la clé, sans la date, qui bouge entre le prévu et le
réalisé. Le lien est donc idempotent et rétroactif. Aucun rapprochement flou : un
code renommé se règle par un alias du référentiel.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from ..models import INACTIVE_STATUSES, CostKeyYear, Session


class MatchStatus(StrEnum):
    MATCHED = "MATCHED"
    SHORTFALL = "SHORTFALL"
    EXTRA = "EXTRA"
    PLANNED_ONLY = "PLANNED_ONLY"
    ACTUAL_ONLY = "ACTUAL_ONLY"


@dataclass(frozen=True)
class MatchGroup:
    brand_id: UUID
    code_norm: str
    host_id: UUID
    planned: int
    actual: int

    @property
    def status(self) -> MatchStatus:
        if not self.actual:
            return MatchStatus.PLANNED_ONLY
        if not self.planned:
            return MatchStatus.ACTUAL_ONLY
        if self.actual == self.planned:
            return MatchStatus.MATCHED
        return MatchStatus.SHORTFALL if self.actual < self.planned else MatchStatus.EXTRA


def match(key: CostKeyYear) -> list[MatchGroup]:
    fields = ("brand_id", "code_norm", "country_id")
    planned = Counter(key.planned_sessions.filter(brand__pole=key.pole)
                      .values_list(*fields))
    actual = Counter(
        Session.objects.filter(year=key.year, brand__pole=key.pole)
        .exclude(status__in=INACTIVE_STATUSES)
        .values_list(*fields)
    )
    return [
        MatchGroup(*g, planned=planned[g], actual=actual[g])
        for g in sorted(set(planned) | set(actual), key=lambda g: (str(g[0]), g[1], str(g[2])))
    ]
