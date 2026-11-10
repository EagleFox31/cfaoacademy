"""Amorçage du référentiel — familles, marques, alias, organisation, comptes.

Commande **explicite** : jamais appelée depuis l'entrypoint du conteneur
(interdit n° 10 de l'audit Academix, qui enchaînait migration et seed à chaque
démarrage de production). Elle passe par le job `needs-migrate` (`bootstrap`).

Créer seulement (AGENTS.md §7) : une ligne absente est ajoutée, une ligne présente
n'est jamais réécrite — un libellé, un statut de famille ou un compte modifié en
production survit à chaque démarrage. Sur une base à jour : zéro écriture.

Les agences et les comptes de démonstration ne se chargent qu'avec `--demo`,
jamais en production.
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
TECHNIQUE = CatalogFamily.Section.TECHNIQUE
CARROSSERIE = CatalogFamily.Section.CARROSSERIE
PROCESS = CatalogFamily.Section.PROCESS

FAMILIES = [
    ("techniques-motors",       "Techniques Motors",       Pole.MOBILITY,    True,  "READY",   10, TECHNIQUE),
    ("techniques-equipment",    "Techniques Equipment",    Pole.EQUIPMENT,   True,  "READY",   20, TECHNIQUE),
    # Rubrique à part : la carrosserie ne se décline pas par marque, elle couvre
    # tous les véhicules. Elle occupe donc sa propre ligne, pleine largeur.
    ("techniques-carrosserie",  "Techniques Carrosserie",  Pole.CARROSSERIE, False, "READY",   30, CARROSSERIE),
    ("process-sav-motors",      "Process SAV Motors",      Pole.MOBILITY,    True,  "READY",   40, PROCESS),
    ("process-parts-motors",    "Process Parts Motors",    Pole.MOBILITY,    True,  "READY",   50, PROCESS),
    ("process-sav-equipment",   "Process SAV Equipment",   Pole.EQUIPMENT,   True,  "READY",   60, PROCESS),
    ("process-parts-equipment", "Process Parts Equipment", Pole.EQUIPMENT,   True,  "READY",   70, PROCESS),
    ("conduite-equipment",      "Conduite Equipment",      Pole.EQUIPMENT,   False, "READY",   75, PROCESS),
    # Yamaha est rattaché à Motors : le métier ne lui donne pas de BU à part, et un
    # pôle « Autre » à une seule marque produisait une carte orpheline à l'écran.
    # Catalogue non livré : la famille s'affiche avec un bandeau et ne se saisit pas.
    ("techniques-yamaha",       "Techniques Yamaha",       Pole.MOBILITY,    True,  "PENDING", 80, TECHNIQUE),
]

# ── Marques (spec §3.3) ─────────────────────────────────────────────────────
# Stellantis n'existe plus : CITROEN, FIAT, JEEP et PEUGEOT sont quatre marques.
# Yamaha ferme la liste Motors : moto et bateaux relèvent du même pôle côté métier.
MOBILITY_BRANDS = [
    "BYD", "CITROEN", "FIAT", "JEEP", "MERCEDES",
    "MITSUBISHI", "OMODA & JAECOO", "PEUGEOT", "SUZUKI", "TOYOTA", "YAMAHA",
]
EQUIPMENT_BRANDS = [
    "BT", "FUSO", "HINO", "JCB", "KING LONG",
    "LOVOL", "RENAULT TRUCKS", "SHACMAN", "SINOTRUK", "TOYOTA FORKLIFT",
]

# ── Alias (patron d'import, règle 6) ────────────────────────────────────────
# Une table d'alias est une DONNÉE, pas du code : éditable, datée, attribuée.
ALIASES = [
    ("SINOTRUCK", "sinotruk"),
    ("OMODA & JAECCO", "omoda-jaecoo"),
    ("OMODA JAECOO", "omoda-jaecoo"),
    ("RENAULT TRUCK", "renault-trucks"),
]

# ── Organisation ────────────────────────────────────────────────────────────
# Seule la racine fait partie du référentiel : filiales et agences viennent du
# terrain. Les unités de démonstration n'existent que pour les comptes de démo.
ORG_UNITS = [
    ("groupe",            "CFAO Mobility & Equipment", "",             "fr", None),
]
DEMO_ORG_UNITS = [
    ("groupe.cmr",        "CFAO Cameroun",             "Cameroun",     "fr", "groupe"),
    ("groupe.cmr.douala", "Agence Douala",             "Cameroun",     "fr", "groupe.cmr"),
    ("groupe.civ",        "CFAO Côte d'Ivoire",        "Côte d'Ivoire","fr", "groupe"),
    ("groupe.civ.abidjan","Agence Abidjan",            "Côte d'Ivoire","fr", "groupe.civ"),
    ("groupe.gha",        "CFAO Ghana",                "Ghana",        "en", "groupe"),
    ("groupe.gha.accra",  "Accra branch",              "Ghana",        "en", "groupe.gha"),
]

# ── Comptes de démonstration (--demo) ───────────────────────────────────────
# AUCUN mot de passe : Keycloak est seul dépositaire des identifiants.
#
# Le premier champ est le `sub` OIDC, et c'est la SEULE jointure avec Keycloak :
# `LocalIdentityProvider` cherche le profil par `keycloak_sub`, sans repli sur
# l'email (core/auth/identity.py). Ces valeurs sont donc les `id` fixes des
# comptes déclarés dans keycloak/cfao-needs-realm.json — les deux fichiers se
# modifient ensemble. Un sub qui ne correspond pas produit une connexion réussie
# suivie d'un refus sur tout : périmètre vide, policies en default-deny.
PROFILES = [
    ("a1000001-0000-4000-8000-000000000001", "chef.atelier@cfao.com",  "Chef d'atelier Douala",
     ["workshop_manager"], "groupe.cmr.douala", ["toyota", "peugeot"], "fr", "NEUTRE"),
    ("a1000002-0000-4000-8000-000000000002", "chef.equipe@cfao.com",   "Chef d'équipe Abidjan",
     ["team_manager"], "groupe.civ.abidjan", ["lovol", "hino"], "fr", "NEUTRE"),
    ("a1000003-0000-4000-8000-000000000003", "team.lead@cfao.com",     "Team lead Accra",
     ["team_manager"], "groupe.gha.accra", ["toyota"], "en", "NEUTRE"),
    ("a1000004-0000-4000-8000-000000000004", "directeur.cmr@cfao.com", "Directeur filiale Cameroun",
     ["branch_director"], "groupe.cmr", [], "fr", "NEUTRE"),
    ("a1000005-0000-4000-8000-000000000005", "assistante@cfao.com",    "Assistante centre",
     ["center_assistant"], "groupe", [], "fr", "NEUTRE"),
    ("a1000007-0000-4000-8000-000000000007", "coordonnateur@cfao.com", "Coordonnateur des formations",
     ["training_coordinator"], "groupe", [], "fr", "NEUTRE"),
    ("a1000006-0000-4000-8000-000000000006", "directeur.centre@cfao.com", "Directeur du centre",
     ["center_director"], "groupe", [], "fr", "NEUTRE"),
]


class Command(BaseCommand):
    help = (
        "Crée ce qui manque du référentiel (familles, marques, alias, racine, campagne) ; "
        "--demo ajoute agences et comptes de démonstration."
    )

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int, default=2027, help="Exercice de la campagne à créer.")
        parser.add_argument(
            "--demo",
            action="store_true",
            help="Ajoute agences et comptes de démonstration (jamais en production).",
        )
        parser.add_argument(
            "--open",
            action="store_true",
            help="Ouvre la campagne au lieu de la laisser en brouillon (recette locale).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self.created = 0
        families = self._families()
        brands = self._brands()
        self._aliases(brands)
        units = self._org_units(ORG_UNITS)
        if options["demo"]:
            units = self._org_units(DEMO_ORG_UNITS, units)
            self._profiles(units, brands)
        campaign = self._campaign(options["year"], options["open"])

        self.stdout.write(self.style.SUCCESS(
            f"Référentiel : {self.created} création(s) ; {len(families)} familles, "
            f"{len(brands)} marques, campagne {campaign.year} ({campaign.get_status_display()})."
        ))
        pending = [f.label for f in families.values() if f.status == CatalogFamily.Status.PENDING]
        if pending:
            self.stdout.write(self.style.WARNING(
                "Catalogue en préparation (visible, non saisissable) : " + ", ".join(pending)
            ))

    def _ensure(self, model, defaults, **lookup):
        """get_or_create qui compte les créations ; l'existant n'est jamais réécrit."""
        obj, made = model.objects.get_or_create(defaults=defaults, **lookup)
        self.created += int(made)
        return obj, made

    # ── étapes ───────────────────────────────────────────────────────────────
    def _families(self):
        out = {}
        for key, label, pole, has_brands, status, order, section in FAMILIES:
            out[key], _ = self._ensure(
                CatalogFamily,
                {
                    "label": label, "pole": pole, "has_brands": has_brands,
                    "status": status, "sort_order": order, "section": section,
                },
                key=key,
            )
        return out

    def _brands(self):
        out = {}
        groups = ((MOBILITY_BRANDS, Pole.MOBILITY), (EQUIPMENT_BRANDS, Pole.EQUIPMENT))
        for labels, pole in groups:
            for order, label in enumerate(labels):
                code = self._slug(label)
                out[code], _ = self._ensure(
                    Brand,
                    {"label": label, "pole": pole, "sort_order": order, "is_active": True},
                    code=code,
                )
        return out

    def _aliases(self, brands):
        for alias, brand_code in ALIASES:
            brand = brands.get(brand_code)
            if not brand:
                self.stdout.write(self.style.WARNING(f"Alias ignoré, marque inconnue : {brand_code}"))
                continue
            self._ensure(BrandAlias, {"brand": brand, "added_by": "seed_referential"}, alias=alias)

    def _org_units(self, rows, known=None):
        out = dict(known or {})
        for code, label, country, locale, parent_code in rows:
            # org_path = chaîne d'ancêtres, format identique à la plateforme :
            # c'est ce qui rend la condition Cerbos `scopeNode ∈ orgPath` portable.
            parts = code.split(".")
            org_path = [".".join(parts[: i + 1]) for i in range(len(parts))]
            out[code], _ = self._ensure(
                OrgUnitRef,
                {
                    "label": label, "country": country, "locale": locale,
                    "org_path": org_path, "parent": out.get(parent_code), "is_active": True,
                },
                code=code,
            )
        return out

    def _profiles(self, units, brands):
        for sub, email, name, roles, unit_code, brand_codes, locale, civility in PROFILES:
            profile, made = self._ensure(
                UserProfile,
                {
                    "keycloak_sub": sub, "display_name": name, "roles": roles,
                    "org_unit": units.get(unit_code), "locale": locale,
                    "civility": civility, "is_active": True,
                },
                email=email,
            )
            # Un compte existant garde ses marques : elles se gèrent dans l'outil.
            if made:
                profile.brands.set([brands[c] for c in brand_codes if c in brands])

    def _campaign(self, year, open_it=False):
        campaign, created = self._ensure(
            Campaign,
            {
                "label": f"Identification des Besoins en Formations {year}",
                "status": Campaign.Status.DRAFT,
                "default_locale": "fr",
                "closes_at": timezone.now() + timezone.timedelta(days=45),
            },
            year=year,
        )
        if created:
            self.stdout.write(f"Campagne {year} créée en brouillon — à ouvrir après import du catalogue.")
        # En production l'ouverture est un geste tracé du directeur du centre
        # (POST /campaigns/{id}/open). `--open` ne sert qu'à monter une recette
        # locale saisissable sans rejouer le parcours d'administration.
        if open_it and campaign.status == Campaign.Status.DRAFT:
            campaign.status = Campaign.Status.OPEN
            campaign.opens_at = campaign.opens_at or timezone.now()
            campaign.save(update_fields=["status", "opens_at", "updated_at"])
            self.stdout.write(self.style.WARNING(f"Campagne {year} ouverte (--open)."))
        return campaign

    @staticmethod
    def _slug(label: str) -> str:
        """« OMODA & JAECOO » -> « omoda-jaecoo ». Collapse les separateurs multiples :
        un simple replace("  ", " ") laisse des doubles tirets sur trois espaces."""
        return re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
