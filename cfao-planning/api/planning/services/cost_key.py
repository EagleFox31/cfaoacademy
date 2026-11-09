"""Clé de répartition des coûts par pays (SPEC §8).

Calcul pur, sans écriture : il remplace les formules et les macros du classeur
« Clé de Répartition ». Les besoins viennent de cfao-needs par contrat ; ils sont
passés en paramètre et jamais ressaisis ici.

Deux modes : PLANNED lit le prévisionnel (`PlannedSession`), ACTUAL le réalisé
(`Session`). La refacturation se fait sur le prévu ; `compare` montre l'écart.
"""
from __future__ import annotations

from collections.abc import Mapping
from dataclasses import asdict, dataclass, field
from decimal import ROUND_FLOOR, Decimal
from enum import StrEnum

from django.conf import settings

from referential.models import Trainer
from referential.normalize import norm_key

from ..models import INACTIVE_STATUSES, CostKeyYear, Session

# Version du moteur de calcul, notée dans chaque snapshot de gel.
COST_KEY_ENGINE = 1

_DECIMALS = ("share", "key_cost", "trainee_lodging", "trainer_lodging", "coverage")


class Mode(StrEnum):
    PLANNED = "PLANNED"
    ACTUAL = "ACTUAL"


@dataclass
class CountryLine:
    code: str
    label: str
    enrolled: bool
    seats: int = 0
    academy_seats: int = 0
    trainer_sessions: int = 0
    share: Decimal = Decimal(0)
    key_cost: Decimal = Decimal(0)
    trainee_lodging: Decimal = Decimal(0)
    trainer_lodging: Decimal = Decimal(0)
    needs: int | None = None
    coverage: Decimal | None = None

    @property
    def total(self) -> Decimal:
        return self.key_cost + self.trainee_lodging + self.trainer_lodging


@dataclass
class CostKeyReport:
    year: int
    pole: str
    budget: Decimal
    total_seats: int
    hourly_cost: Decimal | None
    lines: list[CountryLine] = field(default_factory=list)
    mode: str = Mode.ACTUAL

    def to_dict(self) -> dict:
        """JSON du snapshot : les Decimal en texte, pour ne rien perdre."""
        data = asdict(self)
        data["mode"] = str(self.mode)
        data["budget"] = str(self.budget)
        data["hourly_cost"] = None if self.hourly_cost is None else str(self.hourly_cost)
        for line in data["lines"]:
            for name in _DECIMALS:
                if line[name] is not None:
                    line[name] = str(line[name])
        return data

    @classmethod
    def from_dict(cls, data: dict) -> CostKeyReport:
        lines = []
        for raw in data["lines"]:
            raw = dict(raw)
            for name in _DECIMALS:
                if raw[name] is not None:
                    raw[name] = Decimal(raw[name])
            lines.append(CountryLine(**raw))
        hourly = data["hourly_cost"]
        return cls(
            year=data["year"], pole=data["pole"], budget=Decimal(data["budget"]),
            total_seats=data["total_seats"], lines=lines, mode=Mode(data["mode"]),
            hourly_cost=None if hourly is None else Decimal(hourly),
        )


def is_academy_site(session: Session) -> bool:
    if session.location.strip():
        return norm_key(settings.ACADEMY_SITE) in norm_key(session.location)
    return session.country.code == settings.ACADEMY_COUNTRY_CODE


def needs_trainer_lodging(trainer: Trainer, session: Session) -> bool:
    """Seul un formateur hors de son pays se loge : un technicien instructeur (PIC
    Suzuki, Key Instructor Toyota) anime sur place, un formateur de filiale aussi
    chez lui."""
    if trainer.kind != Trainer.Kind.TRAINER:
        return False
    if trainer.home_country_id:
        return trainer.home_country_id != session.country_id
    return session.country.code != settings.ACADEMY_COUNTRY_CODE


def _split_budget(budget: Decimal, weights: dict[str, int]) -> dict[str, Decimal]:
    """Répartit le budget à l'unité près (plus forts restes) : la somme des parts
    vaut toujours le budget, sans écart d'arrondi."""
    total = sum(weights.values())
    if not total:
        return {}
    exact = {k: budget * w / total for k, w in weights.items()}
    floors = {k: v.to_integral_value(rounding=ROUND_FLOOR) for k, v in exact.items()}
    residue = int(budget - sum(floors.values()))
    for k in sorted(exact, key=lambda k: (floors[k] - exact[k], k))[:residue]:
        floors[k] += 1
    return floors


def seat_price(key: CostKeyYear) -> Decimal | None:
    """Prix d'une place quand la clé est tarifée (taux horaire par technicien
    × heures de session) ; None = la clé partage un budget fixe."""
    if key.hourly_rate is None:
        return None
    return Decimal(key.hourly_rate) * key.hours_per_session


def allocate(key: CostKeyYear, weights: dict[str, int]) -> tuple[dict[str, Decimal], Decimal]:
    """(montant par pays, budget effectif). Clé tarifée : chaque pays paie ses
    places au prix unitaire et le budget en découle. Sinon : partage du budget
    au prorata des places, au franc près."""
    price = seat_price(key)
    if price is None:
        return _split_budget(key.budget, weights), key.budget
    if not sum(weights.values()):
        return {}, Decimal(0)
    amounts = {k: price * w for k, w in weights.items()}
    return amounts, sum(amounts.values(), Decimal(0))


def _units(key: CostKeyYear, mode: Mode):
    """(session, formateurs, [(pays, places)]) de chaque session du mode. Une session
    prévue a les mêmes `location` et `country` qu'une réalisée : le calcul est commun."""
    if mode == Mode.PLANNED:
        planned = key.planned_sessions.select_related("country").prefetch_related(
            "trainers", "allocations__country")
        for p in planned:
            yield p, list(p.trainers.all()), [(a.country, a.seats) for a in p.allocations.all()]
        return
    sessions = (
        Session.objects.filter(year=key.year, brand__pole=key.pole)
        .exclude(status__in=INACTIVE_STATUSES)
        .select_related("country")
        .prefetch_related("assignments__trainer", "allocations__country")
    )
    for s in sessions:
        yield (s, [a.trainer for a in s.assignments.all()],
               [(a.country, a.seats) for a in s.allocations.all()])


def compute(key: CostKeyYear, needs: Mapping[str, int] | None = None, *,
            mode: Mode) -> CostKeyReport:
    needs = needs or {}
    enrolled = {c.code: c for c in key.enrolled_countries.all()}
    lines: dict[str, CountryLine] = {
        code: CountryLine(code=code, label=c.label, enrolled=True) for code, c in enrolled.items()
    }

    def line(country) -> CountryLine:
        if country.code not in lines:
            lines[country.code] = CountryLine(code=country.code, label=country.label,
                                              enrolled=False)
        return lines[country.code]

    for session, trainers, allocations in _units(key, mode):
        academy = is_academy_site(session)
        travelling = any(needs_trainer_lodging(t, session) for t in trainers)
        if not academy and travelling:
            line(session.country).trainer_sessions += 1
        for country, seats in allocations:
            current = line(country)
            current.seats += seats
            # Les techniciens du pays de l'Academy sont chez eux : pas d'hébergement.
            if academy and country.code != settings.ACADEMY_COUNTRY_CODE:
                current.academy_seats += seats

    weights = {code: lines[code].seats for code in enrolled}
    total_seats = sum(weights.values())
    shares, budget = allocate(key, weights)
    for current in lines.values():
        if current.enrolled and total_seats:
            current.share = Decimal(current.seats) / total_seats
            current.key_cost = shares[current.code]
        current.trainee_lodging = current.academy_seats * key.trainee_lodging_cost
        current.trainer_lodging = current.trainer_sessions * key.trainer_lodging_cost
        current.needs = needs.get(current.code)
        if current.needs:
            current.coverage = Decimal(current.seats) / current.needs

    hourly = None
    if total_seats:
        hourly = budget / (total_seats * key.hours_per_session)
    return CostKeyReport(
        year=key.year, pole=key.pole, budget=budget, total_seats=total_seats,
        hourly_cost=hourly, lines=sorted(lines.values(), key=lambda l: (not l.enrolled, l.code)),
        mode=mode,
    )


@dataclass
class ComparisonLine:
    code: str
    label: str
    enrolled: bool
    planned_seats: int = 0
    actual_seats: int = 0
    planned_share: Decimal = Decimal(0)
    actual_share: Decimal = Decimal(0)
    planned_key_cost: Decimal = Decimal(0)
    actual_key_cost: Decimal = Decimal(0)
    planned_total: Decimal = Decimal(0)
    actual_total: Decimal = Decimal(0)

    # Écarts : réalisé moins prévu.
    @property
    def delta_seats(self) -> int:
        return self.actual_seats - self.planned_seats

    @property
    def delta_key_cost(self) -> Decimal:
        return self.actual_key_cost - self.planned_key_cost

    @property
    def delta_total(self) -> Decimal:
        return self.actual_total - self.planned_total


@dataclass
class ComparisonReport:
    planned: CostKeyReport
    actual: CostKeyReport
    lines: list[ComparisonLine]
    # Nombre de groupes du lien prévu → réalisé, par statut.
    match: dict[str, int]


def compare(key: CostKeyYear, needs: Mapping[str, int] | None = None) -> ComparisonReport:
    """Prévu (le snapshot si la clé est gelée) face au réalisé, pays par pays."""
    from .plan_match import match

    if key.is_frozen:
        planned = CostKeyReport.from_dict(key.snapshot.report)
    else:
        planned = compute(key, needs, mode=Mode.PLANNED)
    actual = compute(key, needs, mode=Mode.ACTUAL)

    rows: dict[str, ComparisonLine] = {}
    for side, report in (("planned", planned), ("actual", actual)):
        for l in report.lines:
            row = rows.setdefault(l.code, ComparisonLine(code=l.code, label=l.label,
                                                         enrolled=l.enrolled))
            setattr(row, f"{side}_seats", l.seats)
            setattr(row, f"{side}_share", l.share)
            setattr(row, f"{side}_key_cost", l.key_cost)
            setattr(row, f"{side}_total", l.total)

    summary: dict[str, int] = {}
    for group in match(key):
        summary[group.status] = summary.get(group.status, 0) + 1
    return ComparisonReport(
        planned=planned, actual=actual, match=summary,
        lines=sorted(rows.values(), key=lambda l: (not l.enrolled, l.code)),
    )
