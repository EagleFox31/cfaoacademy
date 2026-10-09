"""Production du rapport en tache de fond : lancement, suivi, fichier.

La production elle-meme (LibreOffice) est remplacee par un fichier
temporaire : on verifie le parcours, pas le rendu.
"""
import pytest
import time

from comptes_rendus import taches, views
from comptes_rendus.models import TacheRapport

LANCER_EN_FOND = taches.lancer_en_fond


def test_lance_suit_puis_sert_le_fichier(tmp_path, monkeypatch, client):
    fichier = tmp_path / "r.pptx"
    fichier.write_bytes(b"PK-rapport")
    monkeypatch.setattr(views, "rapport", lambda pages, format_: fichier)
    c = client()
    r = c.post("/apercu/rapports", {"pages": [{"diapo": 1, "valeurs": {}}]}, format="json")
    assert r.status_code == 202
    ident = r.json()["id"]
    assert c.get(f"/apercu/rapports/{ident}").json() == {"etat": "pret"}
    f = c.get(f"/apercu/rapports/{ident}/fichier")
    assert f.status_code == 200
    assert b"".join(f.streaming_content) == b"PK-rapport"
    assert 'filename="rapport.pptx"' in f["Content-Disposition"]


def test_le_fichier_garde_le_nom_des_comptes_rendus_des_formateurs(tmp_path, monkeypatch, client):
    fichier = tmp_path / "r.pptx"
    fichier.write_bytes(b"PK-rapport")
    monkeypatch.setattr(views, "rapport", lambda pages, format_: fichier)
    c = client()
    ident = c.post("/apercu/rapports", {"pages": [{"diapo": 1}]}, format="json").json()["id"]
    nom = "Compte rendu formation Diagnostic des systèmes de motorisation des véhicules du 06-10.07.26"
    f = c.get(f"/apercu/rapports/{ident}/fichier", {"nom": nom})
    assert "filename*=utf-8''Compte%20rendu%20formation%20Diagnostic%20des%20syst%C3%A8mes" in         f["Content-Disposition"]
    assert f["Content-Disposition"].endswith("du%2006-10.07.26.pptx")
    assert views.nom_de_fichier('a/b:c*?"<>|d') == "a-b-c-d"
    assert views.nom_de_fichier("  ") == "rapport"


def test_un_echec_de_production_est_signale_sans_detail_interne(monkeypatch, client):
    def panne(pages, format_):
        raise RuntimeError("conversion pptx sans resultat")
    monkeypatch.setattr(views, "rapport", panne)
    c = client()
    ident = c.post("/apercu/rapports", {"pages": [{"diapo": 1}]}, format="json").json()["id"]
    assert c.get(f"/apercu/rapports/{ident}").json() == {"etat": "echec",
                                                         "erreur": "production du rapport impossible"}
    assert c.get(f"/apercu/rapports/{ident}/fichier").status_code == 404


@pytest.mark.parametrize("route, corps", [
    ("/apercu/page", {"diapo": 1}),
    ("/apercu/rapport", {"pages": [{"diapo": 1}]}),
    ("/apercu/document", {"parties": ["x"]}),
])
def test_un_echec_de_rendu_ne_montre_ni_chemin_ni_message(monkeypatch, client, route, corps):
    def panne(*_a, **_k):
        raise KeyError("C:/secret/ppt/slides/slide999.xml")
    for nom in ("image_de", "rapport", "document"):
        monkeypatch.setattr(views, nom, panne)
    r = client().post(route, corps, format="json")
    assert r.status_code == 500 and r.json() == {"erreur": "rendu impossible"}


def test_une_redaction_refusee_ne_montre_pas_l_erreur_du_moteur(monkeypatch, client):
    def panne(*_a, **_k):
        raise KeyError("C:/secret/moteur/tournures.json")
    monkeypatch.setattr(views, "rediger", panne)
    r = client().post("/apercu/redaction", {"type": "fiche", "participant": {}}, format="json")
    assert r.status_code == 400
    assert r.json() == {"erreur": "redaction impossible : donnees du participant incompletes"}


def test_un_autre_formateur_ne_suit_pas_mon_rapport(tmp_path, monkeypatch, client):
    monkeypatch.setattr(views, "rapport", lambda pages, format_: tmp_path / "r.pptx")
    ident = client("fa").post("/apercu/rapports", {"pages": [{"diapo": 1}]}, format="json").json()["id"]
    assert client("fb").get(f"/apercu/rapports/{ident}").status_code == 404
    assert client("fb").get(f"/apercu/rapports/{ident}/fichier").status_code == 404


def test_une_tache_perdue_finit_en_echec(client):
    TacheRapport.objects.create(id="a" * 32, owner="f-demo", format="pptx", debut=time.time() - 7200)
    assert client().get("/apercu/rapports/" + "a" * 32).json()["etat"] == "echec"


def test_refuse_une_demande_vide_ou_un_identifiant_invalide(client):
    c = client()
    assert c.post("/apercu/rapports", {"pages": []}, format="json").status_code == 400
    assert c.get("/apercu/rapports/..%2Fx").status_code == 404
    assert c.get("/apercu/rapports/" + "0" * 32).status_code == 404


def test_un_rendu_ignore_les_photos_d_un_autre_formateur(tmp_path, monkeypatch, client):
    from comptes_rendus.models import Photo
    a_moi, a_lui = "a" * 16, "b" * 16
    Photo.objects.create(owner="f-demo", ident=a_moi)
    Photo.objects.create(owner="fb", ident=a_lui)
    vus = []
    image = tmp_path / "p.png"
    image.write_bytes(b"png")
    monkeypatch.setattr(views, "image_de", lambda d, valeurs, voisines: vus.append((valeurs, voisines)) or image)
    monkeypatch.setattr(views, "rapport", lambda pages, format_: vus.append(pages) or tmp_path / "r.pptx")
    photos = {"9": [{"id": a_moi}, {"id": a_lui}],
              "4": {"Emplacement groupe": {"id": a_lui, "cadrage": None}},
              "7": {"photos": [{"id": a_lui}], "legendes": "chaque"}}
    attendu = {"9": [{"id": a_moi}, {"id": None}],
               "4": {"Emplacement groupe": {"id": None, "cadrage": None}},
               "7": {"photos": [{"id": None}], "legendes": "chaque"}}
    c = client()
    assert c.post("/apercu/page", {"diapo": 9, "valeurs": {"@photos": photos, "t": "x"},
                                   "voisines": [{"diapo": 4, "valeurs": {"@photos": photos}}]},
                  format="json").status_code == 200
    valeurs, voisines = vus.pop()
    assert valeurs == {"@photos": attendu, "t": "x"}
    assert voisines == [{"diapo": 4, "valeurs": {"@photos": attendu}}]
    c.post("/apercu/rapports", {"pages": [{"diapo": 9, "valeurs": {"@photos": photos}}]}, format="json")
    assert vus.pop() == [{"diapo": 9, "valeurs": {"@photos": attendu}}]


@pytest.mark.parametrize("route", ["/apercu/rapport", "/apercu/document"])
def test_un_rapport_telecharge_ignore_les_photos_d_un_autre_formateur(tmp_path, monkeypatch, client, route):
    from comptes_rendus.models import Photo
    a_moi, a_lui = "a" * 16, "b" * 16
    Photo.objects.create(owner="f-demo", ident=a_moi)
    Photo.objects.create(owner="fb", ident=a_lui)
    vus = []
    fichier = tmp_path / "r.pptx"
    fichier.write_bytes(b"PK")
    monkeypatch.setattr(views, "rapport", lambda pages, format_: vus.append(pages[0]["valeurs"]) or fichier)
    monkeypatch.setattr(views, "document", lambda parties, valeurs, *_a: vus.append(valeurs) or fichier)
    valeurs = {"@photos": {"9": [{"id": a_moi}, {"id": a_lui}]}}
    corps = ({"pages": [{"diapo": 9, "valeurs": valeurs}]} if route == "/apercu/rapport"
             else {"parties": ["x"], "valeurs": valeurs})
    assert client().post(route, corps, format="json").status_code == 200
    assert vus == [{"@photos": {"9": [{"id": a_moi}, {"id": None}]}}]


def test_la_file_des_rapports_est_bornee_et_ferme_sa_connexion(monkeypatch):
    from concurrent.futures import wait
    # La conftest remplace `lancer_en_fond` par un appel direct : on prend
    # la vraie, capturee a l'import du module de test.
    soumis, faits, fermetures = [], [], []
    vraie = taches._FILS.submit
    monkeypatch.setattr(taches._FILS, "submit", lambda f: soumis.append(vraie(f)))
    # `connection` vaut une connexion par fil : on remplace le mandataire.
    monkeypatch.setattr(taches, "connection", type("C", (), {"close": lambda _: fermetures.append(1)})())
    for i in range(3):
        LANCER_EN_FOND(faits.append, i)
    wait(soumis, timeout=5)
    assert taches._FILS._max_workers == 2
    assert sorted(faits) == [0, 1, 2] and len(fermetures) == 3
