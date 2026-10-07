"""Production du rapport en tache de fond : lancement, suivi, fichier.

La production elle-meme (LibreOffice) est remplacee par un fichier
temporaire : on verifie le parcours, pas le rendu.
"""
import time

import api


def attendre(client, ident, secondes=5):
    fin = time.time() + secondes
    while time.time() < fin:
        etat = client.get(f'/apercu/rapports/{ident}').get_json()['etat']
        if etat != 'en_cours':
            return etat
        time.sleep(0.05)
    return 'en_cours'


def test_lance_suit_puis_sert_le_fichier(tmp_path, monkeypatch, connecte):
    fichier = tmp_path / 'r.pptx'
    fichier.write_bytes(b'PK-rapport')
    monkeypatch.setattr(api, 'rapport', lambda pages, format_: fichier)
    client = connecte()
    r = client.post('/apercu/rapports', json={'pages': [{'diapo': 1, 'valeurs': {}}]})
    assert r.status_code == 202
    ident = r.get_json()['id']
    assert attendre(client, ident) == 'pret'
    f = client.get(f'/apercu/rapports/{ident}/fichier')
    assert f.status_code == 200
    assert f.data == b'PK-rapport'


def test_le_fichier_garde_le_nom_des_comptes_rendus_des_formateurs(tmp_path, monkeypatch, connecte):
    fichier = tmp_path / 'r.pptx'
    fichier.write_bytes(b'PK-rapport')
    monkeypatch.setattr(api, 'rapport', lambda pages, format_: fichier)
    client = connecte()
    ident = client.post('/apercu/rapports', json={'pages': [{'diapo': 1}]}).get_json()['id']
    assert attendre(client, ident) == 'pret'
    nom = 'Compte rendu formation Diagnostic des systèmes de motorisation des véhicules du 06-10.07.26'
    f = client.get(f'/apercu/rapports/{ident}/fichier', query_string={'nom': nom})
    assert "filename*=UTF-8''Compte%20rendu%20formation%20Diagnostic%20des%20syst%C3%A8mes" in \
        f.headers['Content-Disposition']
    assert f.headers['Content-Disposition'].endswith('du%2006-10.07.26.pptx')
    assert api.nom_de_fichier('a/b:c*?"<>|d') == 'a-b-c-d'
    assert api.nom_de_fichier('  ') == 'rapport'


def test_un_echec_de_production_est_signale(monkeypatch, connecte):
    def panne(pages, format_):
        raise RuntimeError('conversion pptx sans resultat')
    monkeypatch.setattr(api, 'rapport', panne)
    client = connecte()
    ident = client.post('/apercu/rapports', json={'pages': [{'diapo': 1}]}).get_json()['id']
    assert attendre(client, ident) == 'echec'
    assert client.get(f'/apercu/rapports/{ident}/fichier').status_code == 404


def test_refuse_une_demande_vide_ou_un_identifiant_invalide(connecte):
    client = connecte()
    assert client.post('/apercu/rapports', json={'pages': []}).status_code == 400
    assert client.get('/apercu/rapports/..%2Fx').status_code == 404
    assert client.get('/apercu/rapports/' + '0' * 32).status_code == 404
