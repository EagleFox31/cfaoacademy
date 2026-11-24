"""Tests unitaires de l'import du référentiel — story 16-4.

Le premier test est celui qui compte : **la clé naturelle**. Le fichier 2027 compte
261 lignes pour 231 codes distincts ; `TP02` existe à l'identique sur dix marques.
Un import qui dédoublonne sur `code` seul perd 30 lignes, sans rien signaler.
"""
from io import BytesIO

import pytest
from openpyxl import Workbook

from campaigns.imports.catalog import COLUMNS, CatalogImporter
from campaigns.models import Campaign, CatalogLine
from core.imports.template import build_template
from referential.models import Brand, BrandAlias, CatalogFamily, Pole

pytestmark = pytest.mark.django_db

EQUIPMENT_BRANDS = [
    "BT", "FUSO", "HINO", "JCB", "KING LONG",
    "LOVOL", "RENAULT TRUCKS", "SHACMAN", "SINOTRUK", "TOYOTA FORKLIFT",
]


def _workbook(headers: list[str], rows: list[list]) -> BytesIO:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return buffer


@pytest.fixture
def campaign():
    return Campaign.objects.create(year=2027, label="Campagne 2027")


@pytest.fixture
def equipment_family():
    return CatalogFamily.objects.create(
        key="process-parts-equipment",
        label="Process Parts Equipment",
        pole=Pole.EQUIPMENT,
        status=CatalogFamily.Status.READY,
    )


@pytest.fixture
def motors_family():
    return CatalogFamily.objects.create(
        key="techniques-motors",
        label="Techniques Motors",
        pole=Pole.MOBILITY,
        status=CatalogFamily.Status.READY,
    )


@pytest.fixture
def equipment_brands():
    return [
        Brand.objects.create(code=label.lower().replace(" ", "-"), label=label, pole=Pole.EQUIPMENT)
        for label in EQUIPMENT_BRANDS
    ]


def test_meme_code_sur_dix_marques_donne_dix_lignes(campaign, equipment_family, equipment_brands):
    """TP02 existe sur 10 marques : la clé est (famille, marque, code), pas code."""
    rows = [
        ["process-parts-equipment", label, "TP02",
         "Utilisation de la plateforme de référencement des pièces constructeur",
         "Manager + Front office + back office"]
        for label in EQUIPMENT_BRANDS
    ]
    stream = _workbook(["Famille", "Marque", "Code", "Intitulé", "Public cible"], rows)

    importer = CatalogImporter(campaign)
    result = importer.parse(stream)

    assert result.ok, result.errors
    assert len(result.rows) == 10, "dédoublonnage sur `code` seul → 30 lignes perdues"

    importer.apply(result)
    assert CatalogLine.objects.filter(campaign=campaign, code="TP02").count() == 10


def test_ligne_transverse_stocke_marque_nulle(campaign, equipment_family):
    """« TOUTES MARQUES EQUIPMENT » n'est pas une marque : c'est l'absence de marque."""
    stream = _workbook(
        ["Famille", "Marque", "Code", "Intitulé", "Public cible"],
        [["process-parts-equipment", "TOUTES MARQUES EQUIPMENT", "PART01",
          "Standardisation des processus du département pièces", "Managers, Back-office"]],
    )

    importer = CatalogImporter(campaign)
    result = importer.parse(stream)
    importer.apply(result)

    line = CatalogLine.objects.get(campaign=campaign, code="PART01")
    assert line.brand is None
    assert Brand.objects.filter(label__icontains="TOUTES").count() == 0
    assert any(n.rule == "cross_brand" for n in result.normalizations)


def test_alias_de_marque_corrige_et_trace(campaign, equipment_family, equipment_brands):
    """SINOTRUCK → SINOTRUK : corrigé, appliqué, ET visible au rapport (règle 6)."""
    sinotruk = Brand.objects.get(label="SINOTRUK")
    BrandAlias.objects.create(alias="SINOTRUCK", brand=sinotruk, added_by="import-2027")

    stream = _workbook(
        ["Famille", "Marque", "Code", "Intitulé"],
        [["process-parts-equipment", "SINOTRUCK", "TP02", "Plateforme de référencement"]],
    )

    importer = CatalogImporter(campaign)
    result = importer.parse(stream)

    assert result.ok
    assert result.rows[0]["brand"] == sinotruk
    normalisation = next(n for n in result.normalizations if n.rule == "alias")
    assert normalisation.from_value == "SINOTRUCK"
    assert normalisation.to_value == "SINOTRUK"


def test_public_cible_scinde_en_niveau_et_populations(campaign, equipment_family, equipment_brands):
    """La colonne source mélange deux notions et des séparateurs libres."""
    importer = CatalogImporter(campaign)

    assert importer._split_audience("SENIOR") == ("SENIOR", [])
    assert importer._split_audience("Manager + Front office + back office") == (
        "", ["MANAGER", "FRONT_OFFICE", "BACK_OFFICE"],
    )
    assert importer._split_audience("Managers, Back-office ; Front-Office") == (
        "", ["MANAGER", "FRONT_OFFICE", "BACK_OFFICE"],
    )
    assert importer._split_audience("") == ("", [])


def test_marque_inconnue_est_rejetee_avec_un_message_actionnable(
    campaign, motors_family, equipment_brands
):
    Brand.objects.create(code="toyota", label="TOYOTA", pole=Pole.MOBILITY)
    stream = _workbook(
        ["Famille", "Marque", "Code", "Intitulé"],
        [["techniques-motors", "TOYOTA HYBRID", "TFT01", "Standards SAV"]],
    )

    result = CatalogImporter(campaign).parse(stream)

    assert not result.ok
    error = result.errors[0]
    assert error.code == "BRAND_UNKNOWN"
    assert "TOYOTA" in error.message
    assert "vide" in error.message  # indique la sortie « transverse »


def test_rien_nest_ecrit_quand_une_ligne_est_fautive(campaign, motors_family):
    """Règle 4 : tout ou rien. Un import partiel est le pire mode d'échec."""
    Brand.objects.create(code="toyota", label="TOYOTA", pole=Pole.MOBILITY)
    stream = _workbook(
        ["Famille", "Marque", "Code", "Intitulé"],
        [
            ["techniques-motors", "TOYOTA", "TFT01", "Standards SAV"],
            ["techniques-motors", "MARQUE INEXISTANTE", "TFT02", "Autre"],
        ],
    )

    importer = CatalogImporter(campaign)
    result = importer.parse(stream)
    log = importer.apply(result)

    assert log.status == log.Status.REJECTED
    assert CatalogLine.objects.filter(campaign=campaign).count() == 0


def test_entetes_reconnus_par_synonymes(campaign, motors_family):
    """Règle 1 : « CODE FORMATION » et « code » désignent la même colonne."""
    Brand.objects.create(code="toyota", label="TOYOTA", pole=Pole.MOBILITY)
    stream = _workbook(
        ["DOMAINE", "Constructeur", "CODE FORMATION", "Libellé", "Observations"],
        [["techniques-motors", "TOYOTA", "TFT01", "Standards SAV", "note libre"]],
    )

    result = CatalogImporter(campaign).parse(stream)

    assert result.ok, result.errors
    assert result.unknown_columns == ["Observations"]  # ignorée, jamais une erreur


def test_colonne_obligatoire_manquante_arrete_avant_ecriture(campaign, motors_family):
    stream = _workbook(["Famille", "Marque"], [["techniques-motors", "TOYOTA"]])

    result = CatalogImporter(campaign).parse(stream)

    assert result.fatal
    assert "Code" in result.fatal
    assert "modèle vierge" in result.fatal


def test_doublon_dans_le_fichier_est_signale(campaign, motors_family):
    Brand.objects.create(code="toyota", label="TOYOTA", pole=Pole.MOBILITY)
    stream = _workbook(
        ["Famille", "Marque", "Code", "Intitulé"],
        [
            ["techniques-motors", "TOYOTA", "TFT01", "Standards SAV"],
            ["techniques-motors", "TOYOTA", "TFT01", "Standards SAV (doublon)"],
        ],
    )

    result = CatalogImporter(campaign).parse(stream)

    assert not result.ok
    assert result.errors[0].code == "DUPLICATE_KEY"
    assert "ligne 2" in result.errors[0].message


def test_titre_anglais_repris_du_catalogue_publie(campaign, motors_family):
    """Le classeur métier n'a pas de colonne anglaise : le titre vient de la table.

    Sans ce rapprochement, un utilisateur anglophone lirait 261 titres en
    français — c'est ce qui a motivé `titles_en.json`.
    """
    Brand.objects.create(code="toyota", label="TOYOTA", pole=Pole.MOBILITY)
    stream = _workbook(
        ["Famille", "Marque", "Code", "Intitulé"],
        [["techniques-motors", "TOYOTA", "BEV02", "Maintenance préventive des véhicules électriques"]],
    )

    importer = CatalogImporter(campaign)
    result = importer.parse(stream)
    importer.apply(result)

    line = CatalogLine.objects.get(campaign=campaign, code="BEV02")
    assert line.title.startswith("Maintenance préventive")
    assert line.title_en == "Preventive maintenance of BYD electric vehicles"


def test_un_meme_code_sur_deux_formations_garde_deux_traductions(campaign, equipment_family):
    """TP01 et TP02 désignent des formations différentes selon la famille.

    Le catalogue va jusqu'à les inverser d'un pôle à l'autre. Une table indexée
    sur le code leur donnerait la même traduction, fausse et silencieuse — c'est
    pourquoi elle est indexée sur l'intitulé.
    """
    argumentaire = "Développement de l'argumentaire technique de vente des pièces de maintenance"
    plateforme = "Utilisation de la plateforme de référencement des pièces constructeur"
    stream = _workbook(
        ["Famille", "Marque", "Code", "Intitulé"],
        [
            ["process-parts-equipment", "", "TP01", argumentaire],
            ["process-parts-equipment", "", "TP02", plateforme],
        ],
    )

    importer = CatalogImporter(campaign)
    result = importer.parse(stream)
    importer.apply(result)

    traductions = {
        line.code: line.title_en
        for line in CatalogLine.objects.filter(campaign=campaign)
    }
    assert traductions["TP01"] == "Developing technical sales arguments for maintenance parts"
    assert traductions["TP02"] == "Using the manufacturer parts catalogue platform"


def test_colonne_anglaise_du_classeur_prime_sur_la_table(campaign, motors_family):
    """La table n'est qu'un repli : ce que le métier écrit fait foi."""
    Brand.objects.create(code="toyota", label="TOYOTA", pole=Pole.MOBILITY)
    stream = _workbook(
        ["Famille", "Marque", "Code", "Intitulé", "Intitulé EN"],
        [["techniques-motors", "TOYOTA", "BEV02", "Maintenance préventive", "Agreed wording"]],
    )

    importer = CatalogImporter(campaign)
    result = importer.parse(stream)
    importer.apply(result)

    assert CatalogLine.objects.get(campaign=campaign, code="BEV02").title_en == "Agreed wording"


def test_intitule_sans_traduction_reste_en_francais(campaign, motors_family):
    """Un titre manquant ne bloque pas l'import : la ligne s'affiche en français."""
    Brand.objects.create(code="toyota", label="TOYOTA", pole=Pole.MOBILITY)
    stream = _workbook(
        ["Famille", "Marque", "Code", "Intitulé"],
        [["techniques-motors", "TOYOTA", "ZZZ99", "Formation inédite jamais publiée"]],
    )

    importer = CatalogImporter(campaign)
    result = importer.parse(stream)
    importer.apply(result)

    assert result.ok, result.errors
    assert CatalogLine.objects.get(campaign=campaign, code="ZZZ99").title_en == ""


def test_les_ecritures_divergentes_du_meme_intitule_se_rapprochent():
    """Apostrophe droite ou typographique, casse, ponctuation : même formation.

    Comparer les intitulés bruts ferait manquer la moitié des correspondances,
    et il faudrait tenir une table d'alias qui grossirait à chaque export.
    """
    from campaigns.imports.titles_en import english_title, normalize_title

    assert normalize_title("Avis d’intervention sur véhicules électriques") == normalize_title(
        "Avis d'intervention sur vehicules electriques"
    )
    attendu = "Intervention notice on BYD electric vehicle"
    assert english_title("Avis d’intervention sur véhicules électriques") == attendu
    assert english_title("  AVIS D'INTERVENTION SUR VÉHICULES ÉLECTRIQUES  ") == attendu
    assert english_title("Formation qui n'existe pas") == ""


def test_niveau_constructeur_repris_de_la_vitrine(campaign, motors_family):
    """Toyota lit G4, pas seulement JUNIOR — c'est la nomenclature de la marque."""
    Brand.objects.create(code="toyota", label="TOYOTA", pole=Pole.MOBILITY)
    stream = _workbook(
        ["Famille", "Marque", "Code", "Intitulé", "Public cible"],
        [["techniques-motors", "TOYOTA", "TS01-G4",
          "Maintenance préventive périodique et non-périodique des véhicules", "JUNIOR"]],
    )

    importer = CatalogImporter(campaign)
    result = importer.parse(stream)
    importer.apply(result)

    line = CatalogLine.objects.get(campaign=campaign, code="TS01-G4")
    assert line.tier == "JUNIOR"
    assert line.level_label == "G4"


def test_suffixe_suzuki_donne_le_niveau_bronze(campaign, motors_family):
    """SS01-BRONZE côté 2027, SS01 sous BRONZE côté vitrine : même niveau."""
    Brand.objects.create(code="suzuki", label="SUZUKI", pole=Pole.MOBILITY)
    stream = _workbook(
        ["Famille", "Marque", "Code", "Intitulé", "Public cible"],
        [["techniques-motors", "SUZUKI", "SS01-BRONZE",
          "Maintenance préventive périodique", "JUNIOR"]],
    )

    importer = CatalogImporter(campaign)
    result = importer.parse(stream)
    assert result.ok, result.errors
    importer.apply(result)

    assert CatalogLine.objects.get(campaign=campaign, code="SS01-BRONZE").level_label == "Bronze"


def test_le_modele_vierge_se_relit_avec_le_meme_parseur(campaign, motors_family):
    """Règle 2 : modèle et parseur viennent de la même définition — ils ne peuvent
    pas diverger. Le modèle généré doit donc être relisible tel quel."""
    Brand.objects.create(code="toyota", label="TOYOTA", pole=Pole.MOBILITY)
    from campaigns.imports.catalog import EXAMPLE_ROW

    content = build_template(COLUMNS, "Catalogue 2027", EXAMPLE_ROW)
    result = CatalogImporter(campaign).parse(BytesIO(content))

    assert result.ok, result.errors
    assert result.rows[0]["code"] == "TFT01"


def test_suzuki_replie_le_palier_sur_son_bareme():
    from campaigns.imports.levels import level_label

    assert level_label("SNM01", tier="SENIOR", brand="SUZUKI") == "Silver"
    assert level_label("SNM01", tier="SENIOR", brand="MERCEDES") == "Senior"
