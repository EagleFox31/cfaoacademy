"""Import du référentiel de campagne — story 16-4.

Application du patron tabulaire (docs/PATRON_IMPORT_TABULAIRE.md) au cas le plus
piégeux du module :

  - clé naturelle `(campagne, famille, marque, code)` — **jamais `code` seul**
  - marque **nullable** : « TOUTES MARQUES VL/EQUIPMENT » devient NULL, jamais une
    pseudo-marque
  - colonne « public cible » polluée : elle mélange niveau technicien et famille de
    métier, avec des séparateurs libres → scindée en `tier` + `populations`
  - alias de marques appliqués et **tracés** (SINOTRUCK → SINOTRUK,
    OMODA & JAECCO → OMODA & JAECOO)
"""
from __future__ import annotations

import re

from core.imports.base import Normalization, ParseResult, RowRejected, TabularImporter
from core.imports.columns import Column, ColumnSpec, normalize_header
from referential.models import Brand, BrandAlias, CatalogFamily

# Libellés qui désignent « pas de marque », pas une marque nommée.
CROSS_BRAND_LABELS = {
    "toutesmarques",
    "toutesmarquesvl",
    "toutesmarquesequipment",
    "toutesmarquespl",
    "all",
    "allbrands",
}

TIERS = {"JUNIOR", "SENIOR", "EXPERT"}

# La colonne source écrit « Manager + Front office + back office »,
# « Managers, Back-office ; Front-Office »… → un vocabulaire normalisé.
POPULATION_PATTERNS = (
    (re.compile(r"manager", re.I), "MANAGER"),
    (re.compile(r"front", re.I), "FRONT_OFFICE"),
    (re.compile(r"back", re.I), "BACK_OFFICE"),
)


COLUMNS = ColumnSpec(
    columns=[
        Column(
            key="family",
            labels=("Famille", "Famille de catalogue", "BU", "Domaine"),
            help_text="Clé de la famille — voir la feuille Aide.",
        ),
        Column(
            key="brand",
            labels=("Marque", "Brand", "Marque constructeur", "Constructeur"),
            required=False,
            help_text="Laisser vide pour une formation transverse à tout le pôle.",
        ),
        Column(
            key="code",
            labels=("Code", "Code formation", "Code module", "Réf", "Référence"),
            help_text="Unique par famille ET par marque — le même code peut exister sur plusieurs marques.",
        ),
        Column(
            key="title",
            labels=("Intitulé", "Module", "Libellé", "Titre", "Formation"),
        ),
        Column(
            key="audience",
            labels=("Public cible", "Public", "Niveau", "Cible"),
            required=False,
            help_text="JUNIOR / SENIOR / EXPERT, ou Manager / Front office / Back-office.",
            allowed=("JUNIOR", "SENIOR", "EXPERT", "Manager", "Front office", "Back-office"),
        ),
    ]
)

EXAMPLE_ROW = {
    "family": "techniques-motors",
    "brand": "TOYOTA",
    "code": "TFT01",
    "title": "Standards SAV Toyota — réception atelier",
    "audience": "SENIOR",
}


class CatalogImporter(TabularImporter):
    kind = "campaign_catalog"
    columns = COLUMNS
    natural_key = ("family_key", "brand_code", "code")

    def __init__(self, campaign):
        self.campaign = campaign
        self._families = {f.key: f for f in CatalogFamily.objects.all()}
        self._brands = {b.code.upper(): b for b in Brand.objects.all()}
        self._brand_labels = {b.label.upper(): b for b in Brand.objects.all()}
        self._aliases = {
            a.alias.upper(): a.brand for a in BrandAlias.objects.select_related("brand")
        }

    # ── validation ligne à ligne ──────────────────────────────────────────────
    def clean_row(self, line: int, values: dict, result: ParseResult) -> dict:
        family_key = self._text(values.get("family"))
        family = self._families.get(family_key) or self._families.get(
            normalize_header(family_key)
        )
        if not family:
            raise RowRejected(
                column="Famille",
                value=family_key,
                code="FAMILY_UNKNOWN",
                message=(
                    f"Famille inconnue « {family_key} ». "
                    f"Familles déclarées : {', '.join(sorted(self._families)) or 'aucune'}."
                ),
            )

        code = self._text(values.get("code"))
        if not code or code in {"-", "--", "n/a", "N/A"}:
            raise RowRejected(
                column="Code",
                value=code,
                code="CODE_REQUIRED",
                message=(
                    "Le code formation est obligatoire et doit être un vrai code. "
                    "Une formation sans code ne peut pas être rapprochée d'une campagne à l'autre."
                ),
            )

        title = self._text(values.get("title"))
        if not title:
            raise RowRejected(
                column="Intitulé",
                value=title,
                code="TITLE_REQUIRED",
                message="L'intitulé de la formation est obligatoire.",
            )

        brand = self._resolve_brand(line, values.get("brand"), family, result)
        tier, populations = self._split_audience(values.get("audience"))

        return {
            "family": family,
            "family_key": family.key,
            "brand": brand,
            "brand_code": brand.code if brand else None,
            "code": code,
            "title": title,
            "tier": tier,
            "populations": populations,
        }

    # ── marques : alias, transverse, inconnu ─────────────────────────────────
    def _resolve_brand(self, line: int, raw, family, result: ParseResult):
        label = self._text(raw)
        if not label or normalize_header(label) in CROSS_BRAND_LABELS:
            # Ligne transverse : marque NULL. Une pseudo-marque « TOUTES MARQUES »
            # polluerait les agrégats et les habilitations.
            if label:
                result.normalizations.append(
                    Normalization(
                        row=line,
                        column="Marque",
                        from_value=label,
                        to_value=None,
                        rule="cross_brand",
                    )
                )
            return None

        key = label.upper()
        brand = self._brands.get(key) or self._brand_labels.get(key)
        if brand:
            return brand

        aliased = self._aliases.get(key)
        if aliased:
            result.normalizations.append(
                Normalization(
                    row=line,
                    column="Marque",
                    from_value=label,
                    to_value=aliased.label,
                    rule="alias",
                )
            )
            return aliased

        acceptees = ", ".join(
            sorted(b.label for b in self._brands.values() if b.pole == family.pole)
        )
        raise RowRejected(
            column="Marque",
            value=label,
            code="BRAND_UNKNOWN",
            message=(
                f"Marque inconnue « {label} ». "
                f"Marques acceptées pour la famille {family.label} : {acceptees or 'aucune'}. "
                f"Laisser la cellule vide pour une formation transverse."
            ),
        )

    # ── public cible : deux notions dans une colonne ─────────────────────────
    @staticmethod
    def _split_audience(raw) -> tuple[str, list[str]]:
        text = "" if raw is None else str(raw).strip()
        if not text:
            return "", []

        upper = text.upper()
        tier = next((t for t in TIERS if t in upper), "")

        populations: list[str] = []
        for pattern, value in POPULATION_PATTERNS:
            if pattern.search(text) and value not in populations:
                populations.append(value)

        return tier, populations

    # ── écriture ─────────────────────────────────────────────────────────────
    def write(self, rows: list[dict]) -> int:
        from campaigns.models import CatalogLine

        CatalogLine.objects.filter(campaign=self.campaign).delete()
        CatalogLine.objects.bulk_create(
            [
                CatalogLine(
                    campaign=self.campaign,
                    family=row["family"],
                    brand=row["brand"],
                    code=row["code"],
                    title=row["title"],
                    tier=row["tier"],
                    populations=row["populations"],
                    sort_order=index,
                )
                for index, row in enumerate(rows)
            ]
        )
        return len(rows)
