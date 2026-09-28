"""Brouillons : contrat HTTP `/cr-donnees/...` et cloisonnement par utilisateur.

Chaque test ecrit dans une base temporaire, jamais dans `donnees/`.
"""
import pytest

import api
import stockage


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(stockage, 'DONNEES', tmp_path)
    monkeypatch.setattr(stockage, 'BASE', tmp_path / 'essai.sqlite')
    return api.app.test_client()


def entete(u):
    return {'X-Utilisateur': u}


def test_ecrit_puis_relit_un_brouillon(client):
    r = client.put('/cr-donnees/brouillons/b1', json={'intitule': 'Essai', 'modifieLe': '2026-01-01T00:00:00.000Z'},
                   headers=entete('u1'))
    assert r.status_code == 200
    assert client.get('/cr-donnees/brouillons/b1', headers=entete('u1')).get_json()['intitule'] == 'Essai'


def test_un_utilisateur_ne_lit_pas_le_brouillon_d_un_autre(client):
    client.put('/cr-donnees/brouillons/b1', json={'modifieLe': '2026-01-01T00:00:00.000Z'}, headers=entete('u1'))
    assert client.get('/cr-donnees/brouillons/b1', headers=entete('u2')).status_code == 404
    assert client.get('/cr-donnees/brouillons', headers=entete('u2')).get_json()['brouillons'] == []


def test_la_version_la_plus_recente_l_emporte(client):
    client.put('/cr-donnees/brouillons/b1', json={'v': 2, 'modifieLe': '2026-01-02T00:00:00.000Z'}, headers=entete('u1'))
    client.put('/cr-donnees/brouillons/b1', json={'v': 1, 'modifieLe': '2026-01-01T00:00:00.000Z'}, headers=entete('u1'))
    assert client.get('/cr-donnees/brouillons/b1', headers=entete('u1')).get_json()['v'] == 2


def test_refuse_une_requete_sans_utilisateur(client):
    assert client.get('/cr-donnees/brouillons').status_code == 401


def test_refuse_un_identifiant_qui_ressemble_a_un_chemin(client):
    r = client.put('/cr-donnees/brouillons/..%2Fbase', json={}, headers=entete('u1'))
    assert r.status_code in (400, 404)
