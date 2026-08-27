"""Amorçage du référentiel — familles, marques, alias, organisation, comptes.

Commande **explicite** : jamais appelée depuis l'entrypoint du conteneur
(interdit n° 10 de l'audit Academix, qui enchaînait migration et seed à chaque
démarrage de production).

Idempotente : rejouable sans dupliquer ni écraser une donnée modifiée à la main.
"""
import re

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from campaigns.models import Campaign
from referential.models import Brand, BrandAlias, CatalogFamily, OrgUnitRef, Pole, UserProfile

# ── Familles (spec §3.2) ─────────────────────────────────────────────────────
# `status` traduit la réalité métier au 27/08/2026 : les catalogues arrivent au
# fil de l'eau, et la campagne s'ouvre sans attendre le dernier.
FAMILIES = [
    ("techniques-motors",       "Techniques Motors",       Pole.MOBILITY,    True,  "READY",   10),
    ("techniques-equipment",    "Techniques Equipment",    Pole.EQUIPMENT,   True,  "READY",   20),
    ("techniques-carrosserie",  "Techniques Carrosserie",  Pole.CARROSSERIE, False, "READY",   30),
    ("process-sav-motors",      "Process SAV Motors",      Pole.MOBILITY,    True,  "READY",   40),
    ("process-parts-motors",    "Process Parts Motors",    Pole.MOBILITY,    True,  "READY",   50),
    ("process-sav-equipment",   "Process SAV Equipment",   Pole.EQUIPMENT,   True,  "READY",   60),
    ("process-parts-equipment", "Process Parts Equipment", Pole.EQUIPMENT,   True,  "READY",   70),
    # Catalogue non livré : la famille s'affiche avec un bandeau et ne se saisit pas.
    ("techniques-yamaha",       "Techniques Yamaha",       Pole.AUTRE,       True,  "PENDING", 80),
]

# ── Marques (spec §3.3) ─────────────────────────────────────────────────────
# Stellantis n'existe plus : CITROEN, FIAT, JEEP et PEUGEOT sont quatre marques.
MOBILITY_BRANDS = [
    "BYD", "CITROEN", "FIAT", "JEEP", "MERCEDES",
    "MITSUBISHI", "OMODA & JAECOO", "PEUGEOT", "SUZUKI", "TOYOTA",
]
EQUIPMENT_BRANDS = [
    "BT", "FUSO", "HINO", "JCB", "KING LONG",
    "LOVOL", "RENAULT TRUCKS", "SHACMAN", "SINOTRUK", "TOYOTA FORKLIFT",
]
OTHER_BRANDS = ["YAMAHA"]

# ── Alias (patron d'import, règle 6) ────────────────────────────────────────
# Une table d'alias est une DONNÉE, pas du code : éditable, datée, attribuée.
ALIASES = [
    ("SINOTRUCK", "sinotruk"),
    ("OMODA & JAECCO", "omoda-jaecoo"),
    ("OMODA JAECOO", "omoda-jaecoo"),
    ("RENAULT TRUCK", "renault-trucks"),
]

# ── Organisation ────────────────────────────────────────────────────────────
ORG_UNITS = [
    ("groupe",            "CFAO Mobility & Equipment", "",             "fr", None),
    ("groupe.cmr",        "CFAO Cameroun",             "Cameroun",     "fr", "groupe"),
    ("groupe.cmr.douala", "Agence Douala",             "Cameroun",     "fr", "groupe.cmr"),
    ("groupe.civ",        "CFAO Côte d'Ivoire",        "Côte d'Ivoire","fr", "groupe"),
    ("groupe.civ.abidjan","Agence Abidjan",            "Côte d'Ivoire","fr", "groupe.civ"),
    ("groupe.gha",        "CFAO Ghana",                "Ghana",        "en", "groupe"),
    ("groupe.gha.accra",  "Accra branch",              "Ghana",        "en", "groupe.gha"),
]

# ── Comptes de démonstration ────────────────────────────────────────────────
# AUCUN mot de passe : Keycloak est seul dépositaire des identifiants.
# `keycloak_sub` sera remplacé par le vrai sujet OIDC à la première connexion.
PROFILES = [
    ("demo-chef-douala",  "chef.atelier@cfao.com",  "Chef d'atelier Douala",
     ["workshop_manager"], "groupe.cmr.douala", ["toyota", "peugeot"], "fr", "NEUTRE"),
    ("demo-chef-abidjan", "chef.equipe@cfao.com",   "Chef d'équipe Abidjan",
     ["team_manager"], "groupe.civ.abidjan", ["lovol", "hino"], "fr", "NEUTRE"),
    ("demo-chef-accra",   "team.lead@cfao.com",     "Team lead Accra",
     ["team_manager"], "groupe.gha.accra", ["toyota"], "en", "NEUTRE"),
    ("demo-dir-cmr",      "directeur.cmr@cfao.com", "Directeur filiale Cameroun",
     ["branch_director"], "groupe.cmr", [], "fr", "NEUTRE"),
    ("demo-assistante",   "assistante@cfao.com",    "Assistante centre",
     ["center_assistant"], "groupe", [], "fr", "NEUTRE"),
    ("demo-dir-centre",   "directeur.centre@cfao.com", "Directeur du centre",
     ["center_director"], "groupe", [], "fr", "NEUTRE"),
]


class Command(BaseCommand):
    help = "Charge familles, marques, alias, organisation, comptes de démonstration et campagne 2027."

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int, default=2027, help="Exercice de la campagne à créer.")

    @transaction.atomic
    def handle(self, *args, **options):
        families = self._families()
        brands = self._brands()
        self._aliases(brands)
        units = self._org_units()
        self._profiles(units, brands)
        campaign = self._campaign(options["year"])

        self.stdout.write(self.style.SUCCESS(
            f"Référentiel chargé : {len(families)} familles, {len(brands)} marques, "
            f"{len(units)} unités, campagne {campaign.year} ({campaign.get_status_display()})."
        ))
        pending = [f.label for f in families.values() if f.status == CatalogFamily.Status.PENDING]
        if pending:
            self.stdout.write(self.style.WARNING(
                "Catalogue en préparation (visible, non saisissable) : " + ", ".join(pending)
            ))

    # ── étapes ───────────────────────────────────────────────────────────────
    def _families(self):
        out = {}
        for key, label, pole, has_brands, status, order in FAMILIES:
            family, _ = CatalogFamily.objects.update_or_create(
                key=key,
                defaults={
                    "label": label, "pole": pole, "has_brands": has_brands,
                    "status": status, "sort_order": order,
                },
            )
            out[key] = family
        return out

    def _brands(self):
        out = {}
        groups = ((MOBILITY_BRANDS, Pole.MOBILITY), (EQUIPMENT_BRANDS, Pole.EQUIPMENT),
                  (OTHER_BRANDS, Pole.AUTRE))
        for labels, pole in groups:
            for order, label in enumerate(labels):
                code = self._slug(label)
                brand, _ = Brand.objects.update_or_create(
                    code=code,
                    defaults={"label": label, "pole": pole, "sort_order": order, "is_active": True},
                )
                out[code] = brand
        return out

    def _aliases(self, brands):
        for alias, brand_code in ALIASES:
            brand = brands.get(brand_code)
            if not brand:
                self.stdout.write(self.style.WARNING(f"Alias ignoré, marque inconnue : {brand_code}"))
                continue
            BrandAlias.objects.update_or_create(
                alias=alias, defaults={"brand": brand, "added_by": "seed_referential"}
            )

    def _org_units(self):
        out = {}
        for code, label, country, locale, parent_code in ORG_UNITS:
            # org_path = chaîne d'ancêtres, format identique à la plateforme :
            # c'est ce qui rend la condition Cerbos `scopeNode ∈ orgPath` portable.
            parts = code.split(".")
            org_path = [".".join(parts[: i + 1]) for i in range(len(parts))]
            unit, _ = OrgUnitRef.objects.update_or_create(
                code=code,
                defaults={
                    "label": label, "country": country, "locale": locale,
                    "org_path": org_path, "parent": out.get(parent_code), "is_active": True,
                },
            )
            out[code] = unit
        return out

    def _profiles(self, units, brands):
        for sub, email, name, roles, unit_code, brand_codes, locale, civility in PROFILES:
            profile, _ = UserProfile.objects.update_or_create(
                email=email,
                defaults={
                    "keycloak_sub": sub, "display_name": name, "roles": roles,
                    "org_unit": units.get(unit_code), "locale": locale,
                    "civility": civility, "is_active": True,
                },
            )
            profile.brands.set([brands[c] for c in brand_codes if c in brands])

    def _campaign(self, year):
        campaign, created = Campaign.objects.get_or_create(
            year=year,
            defaults={
                "label": f"Recueil des besoins {year}",
                "status": Campaign.Status.DRAFT,
                "default_locale": "fr",
                "closes_at": timezone.now() + timezone.timedelta(days=45),
            },
        )
        if created:
            self.stdout.write(f"Campagne {year} créée en brouillon — à ouvrir après import du catalogue.")
        return campaign

    @staticmethod
    def _slug(label: str) -> str:
        """« OMODA & JAECOO » -> « omoda-jaecoo ». Collapse les separateurs multiples :
        un simple replace("  ", " ") laisse des doubles tirets sur trois espaces."""
        return re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
