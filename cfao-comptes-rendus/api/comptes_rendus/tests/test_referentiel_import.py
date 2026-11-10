"""Import du fichier Excel des participants : essai, application, rejeu, refus.

Le fichier est fictif (noms inventes, construit en memoire) : aucune donnee reelle.
"""
import io
from datetime import date, datetime

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.core.files.uploadedfile import SimpleUploadedFile

from comptes_rendus import import_referentiel as imp
from comptes_rendus.models import Animation, Formation, ImportReferentiel, Inscription, Session, Stagiaire

URL = "/cr-donnees/referentiel/import"


def lire(octets):
    return imp.lire(io.BytesIO(octets))


def envoyer(c, octets, appliquer=False):
    donnees = {"fichier": SimpleUploadedFile("participants.xlsx", octets)}
    if appliquer:
        donnees["appliquer"] = "1"
    return c.post(URL, donnees, format="multipart")


def types(rapport):
    return [a["type"] for a in rapport["anomalies"]]


def test_la_lecture_trouve_les_titres_sous_le_preambule(excel):
    lignes = lire(excel())
    assert len(lignes) == 5
    assert lignes[0]["numero"] == "S-2601" and lignes[0]["debut"] == date(2026, 2, 2)
    # Date en texte jj/mm/aaaa
    assert lignes[2]["debut"] == date(2026, 3, 9) and lignes[2]["fin"] == date(2026, 3, 13)
    assert lignes[1]["absent"] is True and lignes[0]["absent"] is False


def test_les_titres_sont_compares_sans_accent_ni_casse_ni_espace_de_fin(excel):
    titres = [t.upper().replace("É", "E") + "  " if t == "Référence" else t for t in
              ["N° de la Formation", "Référence", "Marques", "Désignation formation", "Animateurs",
               "Date début formation", "Date fin formation", "Lieu de la formation", "Noms",
               "Prénoms", "Pays stagiaires", "Présence à la formation"]]
    from comptes_rendus.tests import conftest as c
    lignes = c.lignes_fictives()
    # Les cles internes passent par les titres d'origine : on renomme seulement l'en-tete.
    from openpyxl import load_workbook
    classeur = load_workbook(io.BytesIO(excel(lignes)))
    feuille = classeur["Participants"]
    for cellule in feuille[3]:
        if cellule.value == "Référence":
            cellule.value = titres[1]
        if cellule.value == "Désignation formation":
            cellule.value = "DESIGNATION\nFORMATION "
    sortie = io.BytesIO()
    classeur.save(sortie)
    assert lire(sortie.getvalue())[0]["reference"] == "ABC-101"
    assert lire(sortie.getvalue())[0]["designation"] == "Diagnostic moteur fictif"


def test_essai_n_ecrit_rien(client, pdp_fidele, excel):
    r = envoyer(client("adm"), excel())
    assert r.status_code == 200
    rapport = r.json()
    assert rapport["etat"] == "essai"
    assert (rapport["sessions_a_creer"], rapport["sessions_a_mettre_a_jour"], rapport["sessions_inchangees"]) == (3, 0, 0)
    assert (rapport["stagiaires_a_creer"], rapport["inscriptions_a_creer"], rapport["formations_a_creer"]) == (5, 5, 2)
    assert rapport["animateurs_rattaches"] == ["Marie FICTIVE", "Paul AUTRE"]
    assert rapport["animateurs_non_rattaches"] == ["Jean INCONNU"]
    assert {"reference_vide", "session_trop_longue", "pays_inconnu"} <= set(types(rapport))
    assert not (Session.objects.exists() or Stagiaire.objects.exists() or Formation.objects.exists()
                or Inscription.objects.exists() or Animation.objects.exists() or ImportReferentiel.objects.exists())


def test_application_ecrit_le_referentiel(client, pdp_fidele, excel):
    r = envoyer(client("adm"), excel(), appliquer=True)
    assert r.status_code == 200 and r.json()["etat"] == "applique"
    assert Session.objects.count() == 3 and Stagiaire.objects.count() == 5
    assert Inscription.objects.count() == 5 and Animation.objects.count() == 4
    assert {f.code for f in Formation.objects.all()} == {"ABC-101", "ABC-103"}
    a = Session.objects.get(numero="S-2601")
    assert a.formation.code == "ABC-101" and a.pays == "Cameroun" and a.jours == 3
    assert Session.objects.get(numero="S-2602").formation is None
    assert Session.objects.get(numero="S-2603").jours == 7
    dupont = Stagiaire.objects.get(nom="DUPONT")
    assert (dupont.prenom, dupont.pays) == ("Alice", "Cameroun")
    assert Stagiaire.objects.get(nom="ZOLA").pays == "Atlantide"
    assert Stagiaire.objects.get(nom="KONE").pays == "Côte d'Ivoire"
    assert Inscription.objects.get(stagiaire__nom="DURAND").absent is True
    assert Inscription.objects.get(stagiaire__nom="DUPONT").absent is False
    assert dict(Animation.objects.filter(session=a).values_list("nom_fichier", "formateur_id")) == {
        "Marie FICTIVE": "f-a", "Jean INCONNU": ""}
    assert ImportReferentiel.objects.get().etat == "applique"
    assert ImportReferentiel.objects.get().nom_fichier == "participants.xlsx"


def test_rejouer_le_meme_fichier_ne_cree_rien(client, pdp_fidele, excel):
    c = client("adm")
    envoyer(c, excel(), appliquer=True)
    avant = (Session.objects.count(), Stagiaire.objects.count(), Inscription.objects.count(),
             Animation.objects.count(), Formation.objects.count())
    rapport = envoyer(c, excel(), appliquer=True).json()
    assert (rapport["sessions_a_creer"], rapport["stagiaires_a_creer"], rapport["inscriptions_a_creer"],
            rapport["formations_a_creer"]) == (0, 0, 0, 0)
    assert (rapport["sessions_a_mettre_a_jour"], rapport["sessions_inchangees"]) == (0, 3)
    assert avant == (Session.objects.count(), Stagiaire.objects.count(), Inscription.objects.count(),
                     Animation.objects.count(), Formation.objects.count())
    assert ImportReferentiel.objects.count() == 2


def test_un_stagiaire_retire_du_fichier_est_signale_et_garde(client, pdp_fidele, excel):
    from comptes_rendus.tests.conftest import lignes_fictives
    c = client("adm")
    envoyer(c, excel(), appliquer=True)
    rapport = envoyer(c, excel([l for l in lignes_fictives() if l["nom"] != "Durand"]), appliquer=True).json()
    retires = [a for a in rapport["anomalies"] if a["type"] == "stagiaire_absent_du_fichier"]
    assert len(retires) == 1 and "DURAND" in retires[0]["message"]
    assert Inscription.objects.count() == 5 and Stagiaire.objects.filter(nom="DURAND").exists()


def test_le_reglage_du_formateur_survit_au_reimport(client, pdp_fidele, excel):
    c = client("adm")
    envoyer(c, excel(), appliquer=True)
    Formation.objects.filter(code="ABC-101").update(seuil=80)
    Inscription.objects.filter(stagiaire__nom="DURAND").update(absent=False)
    envoyer(c, excel(), appliquer=True)
    assert Formation.objects.get(code="ABC-101").seuil == 80
    # La colonne Presence ne joue qu'a la creation de l'inscription.
    assert Inscription.objects.get(stagiaire__nom="DURAND").absent is False


def test_un_libelle_de_formation_different_est_signale_sans_etre_modifie(client, pdp_fidele, excel):
    from comptes_rendus.tests.conftest import lignes_fictives
    c = client("adm")
    envoyer(c, excel(), appliquer=True)
    modifiees = [{**l, "designation": "Autre intitule"} if l["numero"] == "S-2601" else l for l in lignes_fictives()]
    rapport = envoyer(c, excel(modifiees), appliquer=True).json()
    assert "libelle_different" in types(rapport)
    assert Formation.objects.get(code="ABC-101").libelle == "Diagnostic moteur fictif"


def test_les_anomalies_de_dates_de_libelles_et_d_homonymes(db, excel):
    from comptes_rendus.tests.conftest import lignes_fictives
    base = lignes_fictives()[0]
    lignes = [
        {**base, "numero": "S-9", "fin": datetime(2026, 1, 20), "debut": datetime(2026, 2, 2)},
        {**base, "numero": "S-10", "nom": "Lune", "prenom": "Ada", "designation": "Premier"},
        {**base, "numero": "S-10", "nom": "Lune", "prenom": "Ada", "designation": "Second"},
    ]
    rapport = imp.analyser(lire(excel(lignes)))
    assert {"fin_avant_debut", "libelles_multiples", "homonyme"} <= set(types(rapport))


def test_une_graphie_de_pays_est_normalisee_sinon_gardee_avec_anomalie():
    assert imp.pays_normalise("CAMEROUN") == ("Cameroun", True)
    assert imp.pays_normalise("RCI")[0] == "Côte d'Ivoire"
    assert imp.pays_normalise("COTE D'IVOIRE")[0] == "Côte d'Ivoire"
    assert imp.pays_normalise("Congo RDC")[0] == "RDC"
    assert imp.pays_normalise("Congo Brazzaville")[0] == "Congo"
    assert imp.pays_normalise("Atlantide") == ("Atlantide", False)


def test_les_animateurs_sont_separes():
    assert imp.animateurs_de("A B / C D, E F et G H\nI J") == ["A B", "C D", "E F", "G H", "I J"]


def test_un_homonyme_de_profil_n_est_pas_rattache(db, profils_referentiel, settings, tmp_path, client, pdp_fidele, excel):
    import json
    profils = profils_referentiel + [{"identifiant": "f.d", "id": "f-d", "roles": ["trainer"],
                                      "firstName": "Fictive", "lastName": "Marie"}]
    (tmp_path / "doublon.json").write_text(json.dumps(profils), encoding="utf-8")
    settings.PROFILS_LOCAUX = str(tmp_path / "doublon.json")
    rapport = imp.analyser(lire(excel()))
    assert "Marie FICTIVE" in rapport["animateurs_non_rattaches"]


def test_une_colonne_manquante_refuse_l_import_en_la_nommant(client, pdp_fidele, excel):
    r = envoyer(client("adm"), excel(sans=("Date fin formation",)), appliquer=True)
    assert r.status_code == 400
    assert "Date fin formation" in r.json()["erreur"]
    assert not Session.objects.exists()
    with pytest.raises(imp.FichierInvalide, match="Référence"):
        lire(excel(sans=("Référence",)))


def test_un_fichier_sans_titres_ou_illisible_est_refuse(client, pdp_fidele):
    c = client("adm")
    assert envoyer(c, b"pas un classeur").status_code == 400
    from openpyxl import Workbook
    vide = io.BytesIO()
    Workbook().save(vide)
    r = envoyer(c, vide.getvalue())
    assert r.status_code == 400 and "N° de la Formation" in r.json()["erreur"]


def test_un_fichier_de_plus_de_10_mo_est_refuse(client, pdp_fidele):
    r = envoyer(client("adm"), b"0" * (10 * 1024 * 1024 + 1))
    assert r.status_code == 413


def test_le_fichier_est_obligatoire(client, pdp_fidele):
    assert client("adm").post(URL, {"appliquer": "1"}, format="multipart").status_code == 400


@pytest.mark.parametrize("identifiant", ["f-a", "tech", "lect", "f-c"])
def test_seul_l_administrateur_du_referentiel_importe(client, pdp_fidele, excel, identifiant):
    r = envoyer(client(identifiant), excel(), appliquer=True)
    assert r.status_code == 403
    assert not Session.objects.exists() and not ImportReferentiel.objects.exists()
    assert pdp_fidele.demandes[-1]["kind"] == "referentiel" and pdp_fidele.demandes[-1]["action"] == "importer"


def test_l_administrateur_du_referentiel_importe(client, pdp_fidele, excel):
    assert envoyer(client("adm"), excel()).status_code == 200


def test_la_commande_importer_est_un_essai_par_defaut(db, profils_referentiel, excel, tmp_path):
    chemin = tmp_path / "participants.xlsx"
    chemin.write_bytes(excel())
    sortie = io.StringIO()
    call_command("importer_referentiel", str(chemin), stdout=sortie)
    assert "ESSAI" in sortie.getvalue() and "sessions a creer : 3" in sortie.getvalue()
    assert not Session.objects.exists()
    call_command("importer_referentiel", str(chemin), "--appliquer", stdout=sortie)
    assert Session.objects.count() == 3
    with pytest.raises(CommandError):
        call_command("importer_referentiel", str(tmp_path / "absent.xlsx"))


# ── Comptes d'administration du referentiel ────────────────────────────

@pytest.fixture
def mode_local(settings, tmp_path):
    import json
    settings.DEPLOYMENT_MODE = "local"
    settings.COMPTES_LOCAUX = str(tmp_path / "comptes.sqlite")
    settings.PROFILS_LOCAUX = str(tmp_path / "profils.json")
    (tmp_path / "profils.json").write_text(json.dumps([]), encoding="utf-8")
    return tmp_path


def test_les_comptes_admin_sont_crees_depuis_l_environnement(mode_local, monkeypatch):
    import json

    from core.auth import comptes
    monkeypatch.setenv("CR_COMPTE_ADMIN_DEV1_MDP", "mdp-un-fictif")
    monkeypatch.setenv("CR_COMPTE_ADMIN_DEV2_MDP", "mdp-deux-fictif")
    sortie = io.StringIO()
    call_command("comptes_referentiel", stdout=sortie)
    profils = json.loads((mode_local / "profils.json").read_text(encoding="utf-8"))
    assert {p["identifiant"]: p["roles"] for p in profils} == {
        "admin.dev1": ["admin_referentiel"], "admin.dev2": ["admin_referentiel"]}
    assert comptes.verifier("admin.dev1", "mdp-un-fictif") and comptes.verifier("admin.dev2", "mdp-deux-fictif")
    assert not comptes.verifier("admin.dev1", "mdp-deux-fictif")
    assert "mdp-un-fictif" not in sortie.getvalue()


def test_un_compte_sans_variable_n_est_pas_cree(mode_local, monkeypatch):
    import json

    from core.auth import comptes
    monkeypatch.setenv("CR_COMPTE_ADMIN_DEV1_MDP", "mdp-un-fictif")
    monkeypatch.delenv("CR_COMPTE_ADMIN_DEV2_MDP", raising=False)
    call_command("comptes_referentiel", stdout=io.StringIO())
    profils = json.loads((mode_local / "profils.json").read_text(encoding="utf-8"))
    assert [p["identifiant"] for p in profils] == ["admin.dev1"]
    assert comptes.existe("admin.dev1") and not comptes.existe("admin.dev2")


def test_sans_aucune_variable_rien_n_est_cree(mode_local, monkeypatch):
    from core.auth import comptes
    monkeypatch.delenv("CR_COMPTE_ADMIN_DEV1_MDP", raising=False)
    monkeypatch.delenv("CR_COMPTE_ADMIN_DEV2_MDP", raising=False)
    call_command("comptes_referentiel", stdout=io.StringIO())
    assert not comptes.existe("admin.dev1") and not comptes.existe("admin.dev2")


def test_un_mot_de_passe_deja_choisi_n_est_pas_remplace(mode_local, monkeypatch):
    from core.auth import comptes
    monkeypatch.setenv("CR_COMPTE_ADMIN_DEV1_MDP", "premier-mdp")
    call_command("comptes_referentiel", stdout=io.StringIO())
    comptes.changer_mot_de_passe("admin.dev1", "choisi-par-l-admin")
    monkeypatch.setenv("CR_COMPTE_ADMIN_DEV1_MDP", "autre-valeur")
    call_command("comptes_referentiel", stdout=io.StringIO())
    assert comptes.verifier("admin.dev1", "choisi-par-l-admin")


def test_hors_mode_local_la_commande_ne_fait_rien(mode_local, settings, monkeypatch):
    from core.auth import comptes
    settings.DEPLOYMENT_MODE = "standalone"
    monkeypatch.setenv("CR_COMPTE_ADMIN_DEV1_MDP", "mdp-un-fictif")
    call_command("comptes_referentiel", stdout=io.StringIO())
    assert not comptes.existe("admin.dev1")


# ── Formations neuves, longueurs, animateurs ───────────────────────────

def lignes_session_neuve(reference="NEW-1", numeros=("S-3001", "S-3002", "S-3003")):
    from comptes_rendus.tests.conftest import LIGNE
    return [{**LIGNE, "numero": n, "reference": reference, "marque": "Toyota", "designation": "Formation neuve",
             "animateurs": "Marie FICTIVE", "debut": datetime(2026, 5, 4 + 7 * i), "fin": datetime(2026, 5, 6 + 7 * i),
             "lieu": "Douala, Cameroun", "nom": f"Nom{i}", "prenom": "Zoe", "pays": "Cameroun", "presence": "Présent"}
            for i, n in enumerate(numeros)]


def comptes(rapport):
    return {k: rapport[k] for k in ("sessions_a_creer", "sessions_a_mettre_a_jour", "sessions_inchangees",
                                    "formations_a_creer", "stagiaires_a_creer", "inscriptions_a_creer")}


def test_une_formation_neuve_partagee_par_trois_sessions_compte_pour_une(db, excel, profils_referentiel):
    lignes = lire(excel(lignes_session_neuve()))
    essai = imp.analyser(lignes)
    applique = imp.appliquer(lignes, auteur="test", nom_fichier="f.xlsx")
    assert essai["formations_a_creer"] == applique["formations_a_creer"] == 1
    assert Formation.objects.filter(code="NEW-1").count() == 1
    assert comptes(essai) == comptes(applique)


def test_une_session_existante_dont_la_formation_est_neuve_est_comptee_pareil_en_essai_et_en_application(
        db, excel, profils_referentiel):
    from comptes_rendus.tests.conftest import lignes_fictives
    imp.appliquer(lire(excel()), auteur="test", nom_fichier="f.xlsx")
    # S-2602 n'avait pas de reference : elle en recoit une, donc une formation neuve.
    modifiees = [{**l, "reference": "NEW-2"} if l["numero"] == "S-2602" else l for l in lignes_fictives()]
    lignes = lire(excel(modifiees))
    essai = imp.analyser(lignes)
    assert (essai["sessions_a_mettre_a_jour"], essai["formations_a_creer"]) == (1, 1)
    applique = imp.appliquer(lignes, auteur="test", nom_fichier="f.xlsx")
    assert comptes(essai) == comptes(applique)
    assert Session.objects.get(numero="S-2602").formation.code == "NEW-2"
    # Rejoue : plus rien a faire.
    assert imp.analyser(lignes)["sessions_a_mettre_a_jour"] == 0


CHAMPS_LONGS = ["numero", "reference", "marque", "designation", "lieu", "nom", "prenom", "pays"]


def test_les_limites_viennent_des_colonnes_du_modele():
    from comptes_rendus.models import Animation, Formation, Session, Stagiaire
    taille = lambda m, c: m._meta.get_field(c).max_length
    assert imp.LIMITES["numero"] == taille(Session, "numero")
    assert imp.LIMITES["reference"] == taille(Formation, "code")
    assert imp.LIMITES["marque"] == taille(Formation, "marque")
    assert imp.LIMITES["designation"] == min(taille(Formation, "libelle"), taille(Session, "libelle_fichier"))
    assert imp.LIMITES["lieu"] == taille(Session, "lieu")
    assert imp.LIMITES["nom"] == taille(Stagiaire, "nom") and imp.LIMITES["prenom"] == taille(Stagiaire, "prenom")
    assert imp.LIMITES["pays"] == min(taille(Stagiaire, "pays"), taille(Session, "pays"))
    assert imp.LIMITE_ANIMATEUR == taille(Animation, "nom_fichier")


@pytest.mark.parametrize("champ", CHAMPS_LONGS)
def test_une_valeur_trop_longue_est_signalee_et_la_ligne_ignoree(db, excel, profils_referentiel, champ):
    from comptes_rendus.tests.conftest import lignes_fictives
    longue = {**lignes_fictives()[0], "numero": "S-LONG", "nom": "Longue", "prenom": "Ligne"}
    longue[champ] = "x" * (imp.LIMITES[champ] + 1)
    lignes = lire(excel(lignes_fictives()[:2] + [longue]))
    numero_de_ligne = lignes[2]["ligne"]
    essai = imp.analyser(lignes)
    applique = imp.appliquer(lignes, auteur="test", nom_fichier="f.xlsx")
    for rapport in (essai, applique):
        trop = [a for a in rapport["anomalies"] if a["type"] == "valeur_trop_longue"]
        assert len(trop) == 1 and f"ligne {numero_de_ligne} ignoree" in trop[0]["message"]
        assert str(imp.LIMITES[champ] + 1) in trop[0]["message"]
        assert rapport["sessions_a_creer"] == 1
    assert comptes(essai) == comptes(applique)
    assert Session.objects.count() == 1 and not Session.objects.filter(numero__startswith="S-LONG").exists()
    assert not Stagiaire.objects.filter(nom="LONGUE").exists()


def test_une_valeur_a_la_limite_est_acceptee(db, excel, profils_referentiel):
    from comptes_rendus.tests.conftest import lignes_fictives
    limite = {**lignes_fictives()[0], "reference": "R" * imp.LIMITES["reference"]}
    rapport = imp.analyser(lire(excel([limite])))
    assert "valeur_trop_longue" not in types(rapport) and rapport["sessions_a_creer"] == 1


def test_un_nom_d_animateur_trop_long_est_ignore_seul(db, excel, profils_referentiel):
    from comptes_rendus.tests.conftest import lignes_fictives
    a = {**lignes_fictives()[0], "animateurs": "Marie FICTIVE / " + "A" * (imp.LIMITE_ANIMATEUR + 1)}
    lignes = lire(excel([a]))
    essai = imp.analyser(lignes)
    imp.appliquer(lignes, auteur="test", nom_fichier="f.xlsx")
    assert types(essai).count("valeur_trop_longue") == 1
    assert essai["sessions_a_creer"] == 1
    assert list(Animation.objects.values_list("nom_fichier", flat=True)) == ["Marie FICTIVE"]


def test_un_animateur_existant_est_retrouve_malgre_la_casse_et_les_espaces(db, excel, profils_referentiel):
    from comptes_rendus.tests.conftest import lignes_fictives
    base = lignes_fictives()[:2]
    avec = lambda nom: [{**l, "animateurs": nom} for l in base]
    imp.appliquer(lire(excel(avec("Jean Dupont"))), auteur="test", nom_fichier="f.xlsx")
    assert Animation.objects.count() == 1
    suite = lire(excel(avec("JEAN  DUPONT")))
    essai = imp.analyser(suite)
    assert (essai["sessions_a_mettre_a_jour"], essai["sessions_inchangees"]) == (0, 1)
    imp.appliquer(suite, auteur="test", nom_fichier="f.xlsx")
    assert list(Animation.objects.values_list("nom_fichier", flat=True)) == ["Jean Dupont"]
