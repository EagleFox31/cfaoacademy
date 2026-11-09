"""Résolution d'une valeur brute du fichier vers une entrée du référentiel.

Un `Resolver` charge les tables une fois par import (pas une requête par ligne)
et répond par correspondance **exacte** sur la forme normalisée : code, libellé,
puis alias. Aucun rapprochement flou n'est appliqué ; `suggest()` ne sert qu'à
enrichir le message d'erreur.
"""
from __future__ import annotations

import difflib
from dataclasses import dataclass

from .models import Brand, Country, Trainer
from .normalize import norm_key


@dataclass
class Match:
    obj: object
    rule: str  # "exact" | "alias"


class Resolver:
    def __init__(self):
        self._brands = self._index(
            Brand.objects.filter(is_active=True).prefetch_related("aliases"),
            lambda b: (b.code, b.label),
        )
        self._countries = self._index(
            Country.objects.filter(is_active=True).prefetch_related("aliases"),
            lambda c: (c.code, c.label),
        )
        self._trainers = self._index(
            Trainer.objects.filter(is_active=True).prefetch_related("aliases"),
            lambda t: (t.name_norm, t.full_name),
        )

    @staticmethod
    def _index(queryset, names):
        exact: dict[str, object] = {}
        alias: dict[str, object] = {}
        for obj in queryset:
            for name in names(obj):
                exact.setdefault(norm_key(name), obj)
            for a in obj.aliases.all():
                alias.setdefault(a.alias_norm, obj)
        return exact, alias

    @staticmethod
    def _lookup(index, raw) -> Match | None:
        exact, alias = index
        key = norm_key(raw)
        if not key:
            return None
        if key in exact:
            return Match(exact[key], "exact")
        if key in alias:
            return Match(alias[key], "alias")
        return None

    def brand(self, raw) -> Match | None:
        return self._lookup(self._brands, raw)

    def country(self, raw) -> Match | None:
        return self._lookup(self._countries, raw)

    def trainer(self, raw) -> Match | None:
        return self._lookup(self._trainers, raw)

    # ── aide au message d'erreur ────────────────────────────────────────────
    def suggest(self, kind: str, raw, n: int = 3) -> list[str]:
        exact, alias = {"brand": self._brands, "country": self._countries,
                        "trainer": self._trainers}[kind]
        candidates = list(exact) + list(alias)
        return difflib.get_close_matches(norm_key(raw), candidates, n=n, cutoff=0.6)

    def accepted(self, kind: str) -> list[str]:
        exact, _ = {"brand": self._brands, "country": self._countries,
                    "trainer": self._trainers}[kind]
        labels = sorted({str(o) for o in exact.values()})
        return labels
