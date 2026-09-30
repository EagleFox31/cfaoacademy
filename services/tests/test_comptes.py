"""Connexion par formulaire : comptes, sessions, cookie."""
import api
import comptes


def test_connexion_ouvre_une_session_que_la_deconnexion_ferme(connecte):
    c = connecte('thierry.essai', 'f-t')
    assert c.get('/cr-donnees/session').get_json()['id'] == 'f-t'
    assert c.post('/cr-donnees/deconnexion').status_code == 200
    assert c.get('/cr-donnees/session').status_code == 401


def test_mauvais_mot_de_passe_refuse_puis_attente(connecte):
    connecte('formateur.a', 'fa')
    c = api.app.test_client()
    for _ in range(comptes.ECHECS_MAX):
        r = c.post('/cr-donnees/connexion', json={'identifiant': 'formateur.a', 'motDePasse': 'faux-faux'})
        assert r.status_code == 401
    r = c.post('/cr-donnees/connexion', json={'identifiant': 'formateur.a', 'motDePasse': 'mot-de-passe-essai'})
    assert r.status_code == 429


def test_se_souvenir_de_moi_donne_un_cookie_durable():
    comptes.enregistrer('formateur.a', 'mot-de-passe-essai', {'id': 'fa'})
    c = api.app.test_client()
    court = c.post('/cr-donnees/connexion', json={'identifiant': 'formateur.a', 'motDePasse': 'mot-de-passe-essai'})
    long_ = c.post('/cr-donnees/connexion', json={'identifiant': 'Formateur.A', 'motDePasse': 'mot-de-passe-essai',
                                                  'seSouvenir': True})
    assert 'Max-Age' not in court.headers['Set-Cookie']
    assert 'Max-Age=2592000' in long_.headers['Set-Cookie']
    assert 'HttpOnly' in long_.headers['Set-Cookie']


def test_le_jeton_n_est_pas_garde_en_clair():
    comptes.enregistrer('formateur.a', 'mot-de-passe-essai', {'id': 'fa'})
    jeton, _ = comptes.ouvrir_session('formateur.a', False)
    with comptes._connexion() as cx:
        assert cx.execute('SELECT count(*) FROM sessions WHERE jeton = ?', (jeton,)).fetchone()[0] == 0
    assert comptes.profil_de(jeton)['id'] == 'fa'


def test_changer_le_mot_de_passe_ferme_les_sessions(connecte):
    c = connecte('formateur.a', 'fa')
    comptes.changer_mot_de_passe('formateur.a', 'nouveau-secret')
    assert c.get('/cr-donnees/session').status_code == 401


def test_le_rendu_demande_une_session():
    assert api.app.test_client().post('/apercu/rapports', json={'pages': [{'diapo': 1}]}).status_code == 401
    assert api.app.test_client().get('/apercu/sante').status_code == 200
