"""Dates et formateurs du prévisionnel, lus dans la grille « Plannings formateurs ».

Les sessions de la clé (classeur et fiches besoins) n'ont souvent ni date ni formateur ;
la grille de l'année, elle, place chaque session sur la ligne d'un formateur. Ce service
rapproche, à la lecture et sans rien écrire, les bandes de la grille (`GridBand`) et les
sessions prévues :

- bande orange (filiale) « TS07-G3 - TOYOTA- SENEGAL » → la session TS07-G3 tenue au Sénégal ;
- bande jaune (Douala) « SNM01 » → les sessions SNM01 tenues à l'Academy, tous pays : un
  créneau de Douala accueille plusieurs filiales.

Une session déjà datée par le classeur prend le créneau le plus proche de sa date (45 jours
au plus) et le retire du lot ; une session sans date reçoit tous les créneaux restants de son
module. Les bandes des lignes « Formations reportées » et « annulées » ne comptent pas.
Les dates de la grille ne remplacent jamais celles d'une session : elles s'affichent à côté.
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

from referential.models import Country
from referential.normalize import norm_code, norm_key
from referential.resolve import Resolver

from ..imports.forecast_grid import ACADEMY, SITE_BY_FILL, SUBSIDIARY
from ..models import CostKeyYear, GridBand, PlannedSession
from .sheet_sessions import DISTANCE, _site

MAX_GAP_DAYS = 45
EXCLUDED_SECTIONS = ("FORMATIONS REPORTEES", "FORMATIONS ANNULEES")
_SPLIT = re.compile(r"[-,()/]+")


@dataclass
class ParsedBand:
    codes: list[str]
    segments: list[str]


@dataclass
class Slot:
    start_date: date
    end_date: date
    trainers: list[str] = field(default_factory=list)
    cells: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {"start_date": self.start_date, "end_date": self.end_date,
                "trainers": self.trainers, "cells": self.cells}


def parse_band(text: str, known_codes: set[str]) -> ParsedBand:
    """Code(s) connus en tête du texte, et le reste découpé en segments (pays, marque, lieu).

    « TS07 » seul se lit « TS07-G3 » s'il n'existe qu'un code connu de cette forme ;
    « SNM01, 02, 03-Congo » donne SNM01, SNM02 et SNM03."""
    # Segments du texte brut (espaces gardées : « RDC Kinshasa » se lit aussi mot par mot).
    # Les morceaux du code (« TS07 », « G3 ») ne sont ni un pays ni une marque.
    segments = [s.strip() for s in _SPLIT.split(text) if s.strip()]
    compact = norm_code(text)
    code = next((k for k in sorted(known_codes, key=len, reverse=True)
                 if compact == k or (compact.startswith(k) and compact[len(k)] in "-,(")), "")
    rest = compact[len(code):]
    if not code and (head := re.match(r"[A-Z0-9/]+", compact)):
        token = head.group(0)
        candidates = [k for k in known_codes if k.startswith(token + "-")]
        if len(candidates) == 1 and (compact == token or compact[len(token)] in "-,("):
            code, rest = candidates[0], compact[len(token):]
    if not code:
        return ParsedBand([], segments)
    codes = [code]
    prefix = re.match(r"[A-Z]+", code)
    while prefix and (more := re.match(r",(\d+)", rest)):
        extra = prefix.group(0) + more.group(1)
        if extra in known_codes:
            codes.append(extra)
        rest = rest[more.end():]
    return ParsedBand(codes, segments)


def _loose(text: str) -> str:
    """Clé tolérante aux fautes de frappe de la grille : « Maadagascar », « Burkina Fasoo »."""
    return re.sub(r"(.)\1+", r"\1", norm_key(text).replace(" ", ""))


def _countries_by_loose() -> dict[str, Country]:
    return {_loose(c.label): c for c in Country.objects.all() if c.label}


def _resolve(resolver: Resolver, segments: list[str], loose: dict | None = None):
    """(pays, marque) lus dans les segments, puis mot par mot ; correspondance exacte ou alias,
    sinon le libellé du pays à une lettre doublée près."""
    country = brand = None
    for segment in segments:
        for candidate in [segment, *segment.split()]:
            if country is None and (m := resolver.country(candidate)):
                country = m.obj
            if country is None and loose and (c := loose.get(_loose(candidate))):
                country = c
            if brand is None and (m := resolver.brand(candidate)):
                brand = m.obj
    return country, brand


def _known_codes(sessions) -> set[str]:
    return {s.code_norm for s in sessions if s.code_norm}


def _join_month_cuts(slots: dict[tuple, Slot]) -> list[Slot]:
    """Recolle les bandes d'une même session coupées par la colonne de mois de la grille
    (30/08→31/08 puis 01/09→03/09) : un créneau qui commence le lendemain de la fin du précédent."""
    joined: list[Slot] = []
    for slot in sorted(slots.values(), key=lambda x: (x.start_date, x.end_date)):
        last = joined[-1] if joined else None
        if last and (slot.start_date - last.end_date).days == 1 and slot.start_date.day == 1:
            last.end_date = slot.end_date
            last.trainers += [t for t in slot.trainers if t not in last.trainers]
            last.cells += slot.cells
        else:
            joined.append(slot)
    return joined


def schedule_for_key(key: CostKeyYear) -> dict:
    """{id de session prévue : [créneaux de la grille, du plus tôt au plus tard]}."""
    return plan_for_key(key)[0]


def plan_for_key(key: CostKeyYear) -> tuple[dict, list[str]]:
    """Créneaux par session, et les bandes que rien n'a rapprochées (diagnostic)."""
    sessions = list(key.planned_sessions.select_related("country", "brand"))
    bands = (GridBand.objects.filter(year=key.year, pole=key.pole, fill_key__in=list(SITE_BY_FILL))
             .exclude(section__in=EXCLUDED_SECTIONS).order_by("start_date", "sheet", "cell"))
    if not sessions or not bands.exists():
        return {}, []
    resolver = Resolver()
    loose = _countries_by_loose()
    known = _known_codes(sessions)

    # Créneaux par groupe : Douala (code) ; filiale (code, pays). Co-animation fusionnée.
    groups: dict[tuple, dict[tuple, Slot]] = defaultdict(dict)
    unmatched = []
    for band in bands:
        parsed = parse_band(band.text, known)
        site = SITE_BY_FILL[band.fill_key]
        country, brand = _resolve(resolver, parsed.segments, loose)
        if not parsed.codes or (site == SUBSIDIARY and country is None):
            unmatched.append(f"{band.sheet}!{band.cell} {band.text}")
            continue
        trainer = ""
        if band.trainer_raw:
            match = resolver.trainer(band.trainer_raw)
            trainer = match.obj.full_name if match else band.trainer_raw
        for code in parsed.codes:
            group = (ACADEMY, code, None, brand.pk if brand else None) if site == ACADEMY \
                else (SUBSIDIARY, code, country.pk, brand.pk if brand else None)
            slot = groups[group].setdefault((band.start_date, band.end_date),
                                            Slot(band.start_date, band.end_date))
            if trainer and trainer not in slot.trainers:
                slot.trainers.append(trainer)
            slot.cells.append(f"{band.sheet}!{band.cell}")

    by_group: dict[tuple, list[PlannedSession]] = defaultdict(list)
    for s in sessions:
        site = _site(s)
        if site == DISTANCE:
            continue
        by_group[(site, s.code_norm, None if site == ACADEMY else s.country_id)].append(s)

    schedule: dict = {}
    matched_groups = set()
    for (site, code, country_id, brand_id), slots in groups.items():
        # La marque lue dans le texte départage deux modules de même code ; une marque écrite
        # autrement (« Peugeot » pour une session Stellantis) n'écarte pas le seul candidat.
        candidates = by_group.get((site, code, country_id), [])
        members = [s for s in candidates if s.brand_id == brand_id] or candidates
        if not members:
            continue
        matched_groups.add((site, code, country_id, brand_id))
        free = _join_month_cuts(slots)
        dated = sorted((s for s in members if s.start_date and s.origin != PlannedSession.Origin.NEEDS_SHEET),
                       key=lambda s: s.start_date)
        for s in dated:
            best = min(free, default=None,
                       key=lambda x: (abs((x.start_date - s.start_date).days), x.start_date))
            if best is not None and abs((best.start_date - s.start_date).days) <= MAX_GAP_DAYS:
                free.remove(best)
                schedule.setdefault(str(s.pk), []).append(best.as_dict())
        for s in members:
            if s in dated:
                continue
            schedule.setdefault(str(s.pk), []).extend(slot.as_dict() for slot in free)
    for group, slots in groups.items():
        if group not in matched_groups:
            unmatched.extend(f"{c}" for slot in slots.values() for c in slot.cells)
    for value in schedule.values():
        value.sort(key=lambda x: (x["start_date"], x["end_date"]))
    return schedule, unmatched
