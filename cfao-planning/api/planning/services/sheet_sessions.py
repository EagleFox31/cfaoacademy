"""Places attribuées sur les fiches besoins, portées au prévisionnel de la clé.

Une case verte (filiale) ou bleue (Douala) d'une fiche attribue des places avant même que
le classeur de la clé les place en session. Tant que la clé n'est pas gelée, chaque module
(pays, marque, code) ainsi attribué devient une session « à dater » d'origine `NEEDS_SHEET`,
pour la part que les sessions du classeur ne couvrent pas encore : le devis compte, chiffre
et détaille ces places comme les autres, et la carte du portail reprend son total.

Le rouge (reporté) et les cases sans couleur ne deviennent jamais des places. Une clé gelée
n'est pas touchée : ses places sont celles de son snapshot.

Idempotent : sur une base à jour, aucune écriture (AGENTS.md §7).
"""
from __future__ import annotations

from collections import defaultdict

from django.conf import settings
from django.db import transaction

from ..models import CostKeyYear, DeliveryMode, NeedsCopyYear, NeedsModuleLine, PlannedAllocation, PlannedSession
from .cost_key import is_academy_site

ACADEMY, SUBSIDIARY, DISTANCE = "academy", "subsidiary", "distance"
SITE_BY_KIND = {
    NeedsModuleLine.Kind.AT_ACADEMY: ACADEMY,
    NeedsModuleLine.Kind.IN_SUBSIDIARY: SUBSIDIARY,
    NeedsModuleLine.Kind.AT_DISTANCE: DISTANCE,
}
ACADEMY_LOCATION, DISTANCE_LOCATION = "Academy de Douala", "À distance"


def _site(session: PlannedSession) -> str:
    if session.delivery_mode == DeliveryMode.DISTANCIEL:
        return DISTANCE
    return ACADEMY if is_academy_site(session) else SUBSIDIARY


def _wanted(key: CostKeyYear) -> dict[tuple, int]:
    """(marque, code, pays, site) → places des fiches que les sessions du classeur ne
    couvrent pas. Les places du classeur d'un module couvrent d'abord ses places à Douala,
    puis en filiale, puis à distance."""
    sheet = defaultdict(int)
    for m in NeedsModuleLine.objects.filter(year=key.year, pole=key.pole.lower(),
                                            kind__in=list(SITE_BY_KIND)):
        sheet[(m.brand_id, m.code_norm, m.country_id, SITE_BY_KIND[m.kind])] += m.places
    covered = defaultdict(int)
    for a in (PlannedAllocation.objects
              .filter(planned_session__cost_key=key)
              .exclude(planned_session__origin=PlannedSession.Origin.NEEDS_SHEET)
              .values_list("planned_session__brand_id", "planned_session__code_norm", "country_id", "seats")):
        covered[a[:3]] += a[3]
    wanted = {}
    for ident in sorted(sheet, key=lambda i: (i[:3], (ACADEMY, SUBSIDIARY, DISTANCE).index(i[3]))):
        module = ident[:3]
        taken = min(covered[module], sheet[ident])
        covered[module] -= taken
        if sheet[ident] - taken > 0:
            wanted[ident] = sheet[ident] - taken
    return wanted


def _titles(key: CostKeyYear) -> dict[tuple, str]:
    """(marque, code) → intitulé : catalogue de cfao-needs (copie de l'année), sinon une
    session du classeur du même module."""
    from referential.models import Brand

    from ..clients.needs import _parse_catalog_levels

    titles = {}
    for s in (key.planned_sessions.exclude(origin=PlannedSession.Origin.NEEDS_SHEET).exclude(title="")
              .values("brand_id", "code_norm", "title")):
        titles.setdefault((s["brand_id"], s["code_norm"]), s["title"])
    copy = NeedsCopyYear.objects.filter(year=key.year).values_list("payload", flat=True).first()
    if copy and copy.get("catalog_levels", {}).get("lines"):
        brand_pk = dict(Brand.objects.values_list("code", "pk"))
        for (brand_code, code), level in _parse_catalog_levels(copy["catalog_levels"]).modules.items():
            if level.title and brand_code in brand_pk:
                titles[(brand_pk[brand_code], code)] = level.title
    return titles


def _location(site: str, country_label: str) -> str:
    # Un lieu toujours écrit : sans lieu, une session au Cameroun passerait pour Douala.
    return {ACADEMY: ACADEMY_LOCATION, DISTANCE: DISTANCE_LOCATION}.get(site, country_label)


def _create(key: CostKeyYear, ident: tuple, seats: int, academy_id, title: str, location: str) -> None:
    brand_id, code_norm, country_id, site = ident
    session = PlannedSession.objects.create(
        cost_key=key, brand_id=brand_id, code_norm=code_norm, origin=PlannedSession.Origin.NEEDS_SHEET,
        country_id=academy_id if site == ACADEMY else country_id, title=title, location=location,
        delivery_mode=DeliveryMode.DISTANCIEL if site == DISTANCE else DeliveryMode.PRESENTIEL,
    )
    PlannedAllocation.objects.create(planned_session=session, country_id=country_id, seats=seats)


def sync_key(key: CostKeyYear) -> int:
    """Aligne les sessions « fiche » d'une clé en préparation ; nombre d'écritures."""
    from referential.models import Country

    if key.is_frozen:
        return 0
    wanted = _wanted(key)
    existing = {}
    stale = []
    for s in (key.planned_sessions.filter(origin=PlannedSession.Origin.NEEDS_SHEET)
              .select_related("country").prefetch_related("allocations")):
        allocations = list(s.allocations.all())
        ident = (s.brand_id, s.code_norm, allocations[0].country_id, _site(s)) if len(allocations) == 1 else None
        if ident is None or ident not in wanted or ident in existing:
            stale.append(s)
        else:
            existing[ident] = allocations[0]
    writes = 0
    for s in stale:
        s.delete()
        writes += 1
    academy = Country.objects.filter(code=settings.ACADEMY_COUNTRY_CODE).values_list("pk", flat=True).first()
    labels = dict(Country.objects.values_list("pk", "label"))
    titles = _titles(key)
    for ident, seats in wanted.items():
        allocation = existing.get(ident)
        title, location = titles.get(ident[:2], ""), _location(ident[3], labels.get(ident[2], ""))
        if allocation is None:
            if ident[3] == ACADEMY and academy is None:
                continue  # pays de l'Academy absent du référentiel : rien à héberger
            _create(key, ident, seats, academy, title, location)
            writes += 1
            continue
        if allocation.seats != seats:
            allocation.seats = seats
            allocation.save(update_fields=["seats", "updated_at"])
            writes += 1
        session = allocation.planned_session
        if (session.title, session.location) != (title or session.title, location):
            session.title, session.location = title or session.title, location
            session.save(update_fields=["title", "location", "updated_at"])
            writes += 1
    return writes


def sync_sheet_sessions(keys=None) -> int:
    """Toutes les clés en préparation (ou celles de `keys`) ; nombre d'écritures."""
    queryset = CostKeyYear.objects.select_for_update().order_by("pk")
    if keys is not None:
        queryset = queryset.filter(pk__in=[getattr(k, "pk", k) for k in keys])
    with transaction.atomic():
        return sum(sync_key(key) for key in queryset)
