"""Production du rapport en tache de fond : lancement, suivi, fichier.

La production elle-meme (LibreOffice) est remplacee par un fichier
temporaire : on verifie le parcours, pas le rendu.
"""
import time

from comptes_rendus import views
from comptes_rendus.models import TacheRapport


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


def test_un_echec_de_production_est_signale(monkeypatch, client):
    def panne(pages, format_):
        raise RuntimeError("conversion pptx sans resultat")
    monkeypatch.setattr(views, "rapport", panne)
    c = client()
    ident = c.post("/apercu/rapports", {"pages": [{"diapo": 1}]}, format="json").json()["id"]
    assert c.get(f"/apercu/rapports/{ident}").json() == {"etat": "echec",
                                                         "erreur": "conversion pptx sans resultat"}
    assert c.get(f"/apercu/rapports/{ident}/fichier").status_code == 404


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
