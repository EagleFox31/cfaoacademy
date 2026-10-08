"""Brouillons : contrat HTTP `/cr-donnees/...` et cloisonnement par proprietaire."""
B1 = "/cr-donnees/brouillons/b1"


def test_ecrit_puis_relit_un_brouillon(client):
    c = client()
    r = c.put(B1, {"intitule": "Essai", "modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    assert r.status_code == 200
    assert r.json() == {"ecrit": True, "brouillon": {"intitule": "Essai",
                                                     "modifieLe": "2026-01-01T00:00:00.000Z"}}
    assert c.get(B1).json()["intitule"] == "Essai"


def test_un_formateur_ne_lit_pas_le_brouillon_d_un_autre(client):
    a, b = client("fa"), client("fb")
    a.put(B1, {"modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    assert b.get(B1).status_code == 404
    assert b.get("/cr-donnees/brouillons").json()["brouillons"] == []


def test_la_version_la_plus_recente_l_emporte(client):
    c = client()
    c.put(B1, {"v": 2, "modifieLe": "2026-01-02T00:00:00.000Z"}, format="json")
    r = c.put(B1, {"v": 1, "modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    assert r.json() == {"ecrit": False, "brouillon": {"v": 2, "modifieLe": "2026-01-02T00:00:00.000Z"}}
    assert c.get(B1).json()["v"] == 2


def test_une_suppression_plus_recente_n_est_pas_annulee(client):
    c = client()
    c.put(B1, {"modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    assert c.delete(B1).json() == {"supprime": True}
    r = c.put(B1, {"modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    assert r.json() == {"ecrit": False, "brouillon": None}
    liste = c.get("/cr-donnees/brouillons").json()
    assert liste["brouillons"] == [] and "b1" in liste["supprimes"]


def test_la_liste_va_du_plus_recent_au_plus_ancien(client):
    c = client()
    c.put("/cr-donnees/brouillons/a", {"n": "a", "modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    c.put("/cr-donnees/brouillons/b", {"n": "b", "modifieLe": "2026-02-01T00:00:00.000Z"}, format="json")
    assert [x["n"] for x in c.get("/cr-donnees/brouillons").json()["brouillons"]] == ["b", "a"]


def test_refuse_une_requete_sans_session(anonyme):
    r = anonyme.get("/cr-donnees/brouillons")
    assert r.status_code == 401
    assert r.json() == {"erreur": "connexion requise"}


def test_refuse_un_identifiant_qui_ressemble_a_un_chemin(client):
    r = client().put("/cr-donnees/brouillons/..%2Fbase", {}, format="json")
    assert r.status_code in (400, 404)
    assert client().put("/cr-donnees/brouillons/a%20b", {}, format="json").status_code == 400


def test_le_perimetre_du_brouillon_est_retenu(client, pdp):
    c = client()
    c.put(B1, {"marque": "toyota", "modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    c.get(B1)
    assert pdp.demandes[-1]["attr"] == {"ownerId": "f-demo", "scopeNode": "", "brand": "toyota"}
