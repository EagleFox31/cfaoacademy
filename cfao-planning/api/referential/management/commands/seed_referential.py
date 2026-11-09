"""Amorçage du référentiel planning — marques, pays, formateurs, alias, couleurs.

Valeurs relevées dans le classeur « Plannings formateurs 2026 V27 » (feuilles
Data, Menu déroulant et calendriers). Commande explicite, jamais lancée par
l'entrypoint ; idempotente : rejouable sans dupliquer.
"""
import re

from django.core.management.base import BaseCommand
from django.db import transaction

from referential.models import (
    AbsenceKeyword, Brand, BrandAlias, ColorRule, Country, CountryAlias, Pole, Trainer,
    TrainerAlias,
)
from referential.normalize import norm_compact, norm_key

# Le planning garde STELLANTIS d'un bloc : ses sessions couvrent les quatre marques.
MOTORS_BRANDS = [
    "TOYOTA", "SUZUKI", "STELLANTIS", "MERCEDES", "BYD", "OMODA & JAECOO", "MITSUBISHI", "YAMAHA",
]
EQUIPMENT_BRANDS = [
    "RENAULT TRUCKS", "JCB", "SINOTRUK", "SHACMAN", "KING LONG", "FUSO", "HINO",
    "TOYOTA FORKLIFT", "BT", "LOVOL",
]
BRAND_ALIASES = [
    ("OMODA & JAECCO", "omoda-jaecoo"), ("OMODA & JAEECO", "omoda-jaecoo"),
    ("SINOTRUCK", "sinotruk"), ("SINOTRUCK HOHAN", "sinotruk"), ("HOHAN", "sinotruk"),
    ("SINO", "sinotruk"), ("RENAULT TRUCK", "renault-trucks"), ("RT", "renault-trucks"),
    ("KL", "king-long"), ("TOY", "toyota"),
]

# (code, libellé, alias du fichier). org_path au format plateforme : groupe.xxx.
COUNTRIES = [
    ("cmr", "Cameroun", ["CFR", "CAMEROUN", "DOUALA"]),
    ("civ", "Côte d'Ivoire", ["RCI", "COTE D IVOIRE"]),
    ("sen", "Sénégal", []),
    # Equipment 2026 : une feuille par site (Kinshasa, Lubumbashi) et le lieu « RDC Lubumbashi ».
    ("cod", "RD Congo", ["RDC", "RDC-KINSHASA", "RDC-LUBUMBASHI", "KINSHASA", "LUBUMBASHI"]),
    ("cog", "Congo", ["CONGO BRAZZAVILLE"]),
    ("gab", "Gabon", []),
    ("ben", "Bénin", []),
    ("bfa", "Burkina Faso", []),
    ("mdg", "Madagascar", []),
    ("mar", "Maroc", []),
    ("mrt", "Mauritanie", []),
    ("ner", "Niger", []),
    ("caf", "Centrafrique", ["RCA"]),
    ("gnq", "Guinée équatoriale", ["RGE"]),
    ("tcd", "Tchad", []),
    ("tgo", "Togo", []),
    ("mli", "Mali", []),
    ("gin", "Guinée", ["GUINEE CONAKRY"]),
    # Entrés dans la clé de répartition 2026 (absents du planning 2025).
    ("gha", "Ghana", []),
    ("ken", "Kenya", []),
    ("nga", "Nigeria", []),
    ("tza", "Tanzanie", []),
    ("gmb", "Gambie", ["GAMBIA"]),
    ("gnb", "Guinée-Bissau", []),
]

# (nom complet, service, externe, alias relevés dans les calendriers)
TRAINERS = [
    ("Eugène EBENE", "MOTORS", False, []),
    ("Damas NGUE LAH", "MOTORS", False, []),
    ("Brice NECHI", "MOTORS", False, []),
    ("Hatem BEN ABID", "MOTORS", False, []),
    ("Cédric PAKO", "MOTORS", False, []),
    ("Coulibaly BOMBA", "MOTORS", False, ["BOMBA COULIBALY"]),
    ("Gérold SADIO", "MOTORS", False, []),
    ("Thierry TAMO", "MOTORS", False, []),
    ("Alassane DIALLO", "MOTORS", False, []),
    ("Jacques MAVILA", "MOTORS", False, []),
    ("Mohammed COLY", "MOTORS", False, []),
    ("Morax YAMINDO", "MOTORS", False, []),
    # Le calendrier Equipment n'écrit que les prénoms.
    ("Lucien GAGNE", "EQUIPMENT", False, ["LUCIEN"]),
    ("Thierry KOUGHA", "EQUIPMENT", False, ["THIERRY"]),
    ("Idris NKOA", "EQUIPMENT", False, ["IDRIS"]),
    ("Roland NENDA", "EQUIPMENT", False, ["ROLAND"]),
    ("Formateur externe", "SAV", True, ["FORMATEUR EXT", "FORMATEUR EXTERNE"]),
]
# Techniciens instructeurs : techniciens habilités à animer à leur niveau, pas
# des formateurs. Chaque marque a son nom pour ce rôle ; le classeur n'écrit que
# le nom du rôle, sans personne. Les instructeurs nommés s'ajoutent comme données.
# (nom, service, externe, alias, code marque)
# Formateurs basés en filiale (les autres sont à l'Academy). Confirmé par le métier ;
# la formule RCI du classeur clé 2026 l'exclut aussi de l'hébergement formateurs.
TRAINER_HOME = {"Coulibaly BOMBA": "civ"}

TECH_INSTRUCTORS = [
    ("PIC", "MOTORS", False, ["PIC SUZUKI"], "suzuki"),
    ("Key Instructor", "MOTORS", False, ["KI", "KEY INSTRUCTOR TOYOTA"], "toyota"),
]

# Couleur de fond → nature de la cellule. Ce qui n'est pas ici part en revue.
COLOR_RULES = [
    ("rgb:FFFFFF00", "", "NORMAL", "Session Academy (Douala)", "Academy session (Douala)"),
    ("rgb:FFFFC000", "", "NORMAL", "Session en filiale", "Subsidiary session"),
    ("rgb:FF00FFFF", "", "NORMAL", "Session Yamaha / Marine", "Yamaha / Marine session"),
    ("rgb:FF00B050", "", "MANUFACTURER", "Formation constructeur", "Manufacturer training"),
    ("rgb:FF92D050", "", "TTT", "Formation de formateurs", "Train the trainer"),
    ("rgb:FF00B0F0", "", "CLIENT", "Client externe", "External client"),
    ("rgb:FFCCCC00", "", "CLIENT", "Programme FNE / UNHCR", "FNE / UNHCR programme"),
    ("rgb:FF66FF66", "", "OTHER", "Support technique", "Technical support"),
    ("rgb:FF7030A0", "", "HOLIDAY", "Jour férié", "Public holiday"),
    ("rgb:FFFFFF99", "", "TITLE", "Intitulé", "Title"),
]

ABSENCE_KEYWORDS = [
    ("CONGES", "LEAVE"), ("CONGE", "LEAVE"), ("CP", "LEAVE"),
    ("RECUP", "RECOVERY"), ("RECUPERATION", "RECOVERY"),
    ("JOURFERIE", "HOLIDAY"), ("FERIE", "HOLIDAY"),
    ("MALADIE", "OTHER"), ("MISSION", "OTHER"),
]


def slug(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", norm_key(label).lower()).strip("-")


class Command(BaseCommand):
    help = "Charge marques, pays, formateurs, alias, règles de couleur et mots-clés d'absence."

    # Creer seulement (AGENTS.md section 7) : une ligne absente est ajoutee, une
    # ligne presente, meme revue en prod, n'est jamais reecrite.
    @transaction.atomic
    def handle(self, *args, **options):
        brands = {}
        for labels, pole in ((MOTORS_BRANDS, Pole.MOTORS), (EQUIPMENT_BRANDS, Pole.EQUIPMENT)):
            for order, label in enumerate(labels):
                brand, _ = Brand.objects.get_or_create(
                    code=slug(label), defaults={"label": label, "pole": pole, "sort_order": order}
                )
                brands[brand.code] = brand
        for alias, code in BRAND_ALIASES:
            BrandAlias.objects.get_or_create(
                alias_norm=norm_key(alias), defaults={"brand": brands[code], "added_by": "seed"}
            )

        for code, label, aliases in COUNTRIES:
            country, _ = Country.objects.get_or_create(
                code=code, defaults={"label": label, "org_path": ["groupe", f"groupe.{code}"]}
            )
            for alias in aliases:
                CountryAlias.objects.get_or_create(
                    alias_norm=norm_key(alias), defaults={"country": country, "added_by": "seed"}
                )

        people = [(*t, None, Trainer.Kind.TRAINER) for t in TRAINERS]
        people += [(*t, Trainer.Kind.TECH_INSTRUCTOR) for t in TECH_INSTRUCTORS]
        for order, (name, service, external, aliases, brand, kind) in enumerate(people):
            trainer, created = Trainer.objects.get_or_create(
                name_norm=norm_key(name),
                defaults={"full_name": name, "service": service, "is_external": external,
                          "kind": kind, "sort_order": order,
                          "home_country": Country.objects.filter(
                              code=TRAINER_HOME.get(name, "")).first()},
            )
            if brand and created:
                trainer.brands.add(brands[brand])
            for alias in aliases:
                TrainerAlias.objects.get_or_create(
                    alias_norm=norm_key(alias), defaults={"trainer": trainer, "added_by": "seed"}
                )

        for key, status, category, fr, en in COLOR_RULES:
            ColorRule.objects.get_or_create(
                fill_key=key,
                defaults={"status": status, "category": category, "label_fr": fr,
                          "label_en": en, "added_by": "seed"},
            )
        for pattern, kind in ABSENCE_KEYWORDS:
            AbsenceKeyword.objects.get_or_create(
                pattern_norm=norm_compact(pattern), defaults={"kind": kind}
            )

        self.stdout.write(self.style.SUCCESS(
            f"Référentiel chargé : {len(brands)} marques, {len(COUNTRIES)} pays, "
            f"{len(TRAINERS)} formateurs, {len(COLOR_RULES)} règles de couleur."
        ))
