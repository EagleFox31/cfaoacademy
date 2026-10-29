"""Le journal des erreurs : ce qui echoue chez un formateur y reste, et
seule l'equipe technique (decision Cerbos) le lit."""
import pytest

from comptes_rendus import erreurs, views
from comptes_rendus.models import Erreur


def _panne(*_a, **_k):
    raise KeyError("C:/secret/ppt/slides/slide999.xml")


@pytest.mark.parametrize("route, corps, action", [
    ("/apercu/page", {"diapo": 4}, "apercu d'une page"),
    ("/apercu/rapport", {"pages": [{"diapo": 1}]}, "rapport complet"),
    ("/apercu/document", {"parties": ["x"]}, "document complet"),
])
def test_un_rendu_en_echec_est_note_avec_sa_pile(monkeypatch, client, route, corps, action):
    for nom in ("image_de", "rapport", "document"):
        monkeypatch.setattr(views, nom, _panne)
    assert client("f-demo").post(route, corps, format="json").status_code == 500
    e = Erreur.objects.get()
    assert (e.origine, e.owner, e.action) == ("service", "f-demo", action)
    assert "slide999" in e.detail and "Traceback" in e.detail


def test_un_rapport_de_fond_en_echec_est_note(monkeypatch, client):
    monkeypatch.setattr(views, "rapport", _panne)
    client("f-demo").post("/apercu/rapports", {"pages": [{"diapo": 2}]}, format="json")
    e = Erreur.objects.get()
    assert (e.action, e.owner, e.contexte["diapos"]) == ("rapport en tache de fond", "f-demo", [2])


def test_le_portail_signale_ce_qu_il_constate(client, pdp):
    r = client("f-demo").post("/cr-donnees/erreurs", {
        "action": "apercu d'une page", "message": "504", "contexte": {"diapo": 7}}, format="json")
    assert r.status_code == 204
    e = Erreur.objects.get()
    assert (e.origine, e.message, e.contexte) == ("portail", "504", {"diapo": 7})
    assert pdp.demandes[-1]["kind"] == "compte_rendu_journal" and pdp.demandes[-1]["action"] == "create"
    assert client().post("/cr-donnees/erreurs", {}, format="json").status_code == 400


def test_la_lecture_passe_par_le_pdp(client, pdp):
    erreurs.noter("portail", "x", "m", detail="", owner="f-demo")
    r = client("s-demo").get("/cr-donnees/erreurs")
    assert r.status_code == 200 and r.json()["erreurs"][0]["action"] == "x"
    assert pdp.demandes[-1]["kind"] == "compte_rendu_journal" and pdp.demandes[-1]["action"] == "read"
    pdp.reponse = False
    assert client("f-demo").get("/cr-donnees/erreurs").status_code == 403


def test_une_exception_non_rattrapee_est_notee(monkeypatch, client):
    monkeypatch.setattr(views.Sante, "get", _panne)
    c = client()
    c.raise_request_exception = False
    assert c.get("/apercu/sante").status_code == 500
    assert Erreur.objects.get().action == "GET /apercu/sante"


def test_le_journal_ne_garde_que_les_dernieres_lignes(monkeypatch, db):
    monkeypatch.setattr(erreurs, "MAXIMUM", 3)
    for i in range(5):
        erreurs.noter("portail", f"a{i}", detail="")
    assert list(Erreur.objects.values_list("action", flat=True)) == ["a4", "a3", "a2"]


def test_noter_n_echoue_jamais(db):
    erreurs.noter("portail", "x", contexte={"objet": object()})
    assert Erreur.objects.get().contexte["objet"].startswith("<object")
