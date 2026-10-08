"""Brouillons : contrat HTTP `/cr-donnees/...` et cloisonnement par proprietaire."""
B1 = "/cr-donnees/brouillons/b1"


def test_ecrit_puis_relit_un_brouillon(client):
    c = client()
    r = c.put(B1, {"intitule": "Essai", "modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    assert r.status_code == 200
    assert r.json() == {"ecrit": True, "brouillon": {"intitule": "Essai", "revision": 1,
                                                     "modifieLe": "2026-01-01T00:00:00.000Z"}}
    assert c.get(B1).json()["intitule"] == "Essai"


def test_un_formateur_ne_lit_pas_le_brouillon_d_un_autre(client):
    a, b = client("fa"), client("fb")
    a.put(B1, {"modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    assert b.get(B1).status_code == 404
    assert b.get("/cr-donnees/brouillons").json()["brouillons"] == []


def test_chaque_ecriture_porte_une_revision(client):
    c = client()
    r = c.put(B1, {"v": 1, "ecrivain": "a", "modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    assert r.json()["brouillon"]["revision"] == 1
    r = c.put(B1, {"v": 2, "revision": 1, "ecrivain": "a", "modifieLe": "2026-01-01T00:01:00.000Z"},
              format="json")
    assert r.json()["ecrit"] is True and r.json()["brouillon"]["revision"] == 2


def test_une_copie_perimee_d_un_autre_onglet_est_refusee(client):
    """Le poste A repart de la revision 1 alors que B a ecrit la 2 :
    meme datee plus tard (horloge du poste), sa copie n'ecrase rien."""
    c = client()
    c.put(B1, {"v": 1, "ecrivain": "a", "modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    c.put(B1, {"v": 2, "revision": 1, "ecrivain": "b", "modifieLe": "2026-01-01T00:01:00.000Z"},
          format="json")
    r = c.put(B1, {"v": 1, "revision": 1, "ecrivain": "a", "modifieLe": "2026-01-09T00:00:00.000Z"},
              format="json")
    assert r.status_code == 409
    assert r.json()["conflit"] is True and r.json()["brouillon"]["v"] == 2
    assert c.get(B1).json()["v"] == 2


def test_un_onglet_enchaine_ses_ecritures_sans_attendre_la_reponse(client):
    """Deux envois partis de la meme revision, du meme onglet : le second
    prolonge le premier, ce n'est pas un conflit."""
    c = client()
    c.put(B1, {"v": 1, "ecrivain": "a", "modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    c.put(B1, {"v": 2, "revision": 1, "ecrivain": "a", "modifieLe": "2026-01-01T00:01:00.000Z"},
          format="json")
    r = c.put(B1, {"v": 3, "revision": 1, "ecrivain": "a", "modifieLe": "2026-01-01T00:02:00.000Z"},
              format="json")
    assert r.status_code == 200 and r.json()["brouillon"]["revision"] == 3


def test_un_envoi_du_meme_onglet_arrive_dans_le_desordre(client):
    c = client()
    c.put(B1, {"v": 2, "ecrivain": "a", "modifieLe": "2026-01-02T00:00:00.000Z"}, format="json")
    r = c.put(B1, {"v": 1, "ecrivain": "a", "modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    assert r.json()["ecrit"] is False and r.json()["brouillon"]["v"] == 2
    assert c.get(B1).json()["v"] == 2


def test_un_brouillon_importe_sans_revision_se_met_a_jour(client):
    from comptes_rendus.models import Brouillon
    c = client()
    Brouillon.objects.create(owner="f-demo", ident="b1", modifie_le="2026-01-01T00:00:00.000Z",
                             contenu={"v": 1, "modifieLe": "2026-01-01T00:00:00.000Z"})
    r = c.put(B1, {"v": 2, "ecrivain": "a", "modifieLe": "2026-01-01T00:01:00.000Z"}, format="json")
    assert r.status_code == 200 and r.json()["brouillon"]["revision"] == 1


def test_une_copie_du_brouillon_supprime_ne_le_fait_pas_revenir(client):
    """Meme datee bien apres la suppression (horloge d'un poste en avance)."""
    c = client()
    c.put(B1, {"modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    assert c.delete(B1).json() == {"supprime": True}
    r = c.put(B1, {"revision": 1, "modifieLe": "2099-01-01T00:00:00.000Z"}, format="json")
    assert r.json() == {"ecrit": False, "brouillon": None}
    liste = c.get("/cr-donnees/brouillons").json()
    assert liste["brouillons"] == [] and "b1" in liste["supprimes"]
    assert liste["revisionsSupprimees"] == {"b1": 1}


def test_un_nouveau_brouillon_apres_suppression_est_garde_meme_date_avant(client):
    """Poste en retard : le nouveau brouillon de la meme session, date avant
    la suppression, est garde ; sa revision repart apres celle supprimee."""
    c = client()
    c.put(B1, {"modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    c.put(B1, {"revision": 1, "modifieLe": "2026-01-01T00:01:00.000Z"}, format="json")
    c.delete(B1)
    r = c.put(B1, {"v": "nouveau", "modifieLe": "2000-01-01T00:00:00.000Z"}, format="json")
    assert r.json()["ecrit"] is True and r.json()["brouillon"]["revision"] == 3
    liste = c.get("/cr-donnees/brouillons").json()
    assert liste["supprimes"] == {} and liste["brouillons"][0]["v"] == "nouveau"


def test_une_suppression_ancienne_sans_revision_garde_la_regle_de_date(client):
    from comptes_rendus.models import Suppression
    c = client()
    Suppression.objects.create(owner="f-demo", ident="b1", le="2026-01-02T00:00:00.000Z")
    r = c.put(B1, {"revision": 4, "modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    assert r.json() == {"ecrit": False, "brouillon": None}
    r = c.put(B1, {"revision": 4, "modifieLe": "2026-01-03T00:00:00.000Z"}, format="json")
    assert r.json()["ecrit"] is True


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
