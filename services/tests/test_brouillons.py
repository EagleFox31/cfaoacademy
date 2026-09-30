"""Brouillons : contrat HTTP `/cr-donnees/...` et cloisonnement par compte.

Chaque test ecrit dans une base temporaire (voir `conftest.py`).
"""
import api

B1 = '/cr-donnees/brouillons/b1'


def test_ecrit_puis_relit_un_brouillon(connecte):
    c = connecte()
    r = c.put(B1, json={'intitule': 'Essai', 'modifieLe': '2026-01-01T00:00:00.000Z'})
    assert r.status_code == 200
    assert c.get(B1).get_json()['intitule'] == 'Essai'


def test_un_formateur_ne_lit_pas_le_brouillon_d_un_autre(connecte):
    a, b = connecte('formateur.a', 'fa'), connecte('formateur.b', 'fb')
    a.put(B1, json={'modifieLe': '2026-01-01T00:00:00.000Z'})
    assert b.get(B1).status_code == 404
    assert b.get('/cr-donnees/brouillons').get_json()['brouillons'] == []


def test_l_entete_utilisateur_ne_donne_plus_acces(connecte):
    connecte('formateur.a', 'fa').put(B1, json={'modifieLe': '2026-01-01T00:00:00.000Z'})
    intrus = api.app.test_client()
    assert intrus.get(B1, headers={'X-Utilisateur': 'fa'}).status_code == 401


def test_la_version_la_plus_recente_l_emporte(connecte):
    c = connecte()
    c.put(B1, json={'v': 2, 'modifieLe': '2026-01-02T00:00:00.000Z'})
    c.put(B1, json={'v': 1, 'modifieLe': '2026-01-01T00:00:00.000Z'})
    assert c.get(B1).get_json()['v'] == 2


def test_refuse_une_requete_sans_session():
    assert api.app.test_client().get('/cr-donnees/brouillons').status_code == 401


def test_refuse_un_identifiant_qui_ressemble_a_un_chemin(connecte):
    r = connecte().put('/cr-donnees/brouillons/..%2Fbase', json={})
    assert r.status_code in (400, 404)
