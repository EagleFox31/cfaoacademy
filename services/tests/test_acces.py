"""Controle d'acces du service de rendu : jeton Keycloak puis decision Cerbos.

Un couple de cles RSA local remplace Keycloak ; un petit serveur HTTP joue
le PDP Cerbos, pour verifier la requete envoyee et le refus par defaut.
"""
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

import acces
import api

CLE = rsa.generate_private_key(public_exponent=65537, key_size=2048)
AUTRE_CLE = rsa.generate_private_key(public_exponent=65537, key_size=2048)
ISSUER = 'http://keycloak.test/realms/cfao'


def jeton(roles, cle=CLE, **plus):
    claims = {'sub': 't_a', 'iss': ISSUER, 'exp': int(time.time()) + 300,
              'realm_access': {'roles': roles}, 'scopeNode': 'groupe.cmr.douala', **plus}
    return jwt.encode(claims, cle, algorithm='RS256')


class PDP(BaseHTTPRequestHandler):
    """Cerbos simule : autorise les roles trainer et center_director."""
    recus = []

    def do_POST(self):
        corps = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        PDP.recus.append(corps)
        action = corps['resources'][0]['actions'][0]
        ok = set(corps['principal']['roles']) & {'trainer', 'center_director'}
        reponse = {'results': [{'actions': {action: 'EFFECT_ALLOW' if ok else 'EFFECT_DENY'}}]}
        self.send_response(200)
        self.send_header('content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(reponse).encode())

    def log_message(self, *args):
        pass


@pytest.fixture
def client(monkeypatch):
    serveur = HTTPServer(('127.0.0.1', 0), PDP)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    monkeypatch.setenv('CERBOS_HTTP', f'http://127.0.0.1:{serveur.server_port}')
    monkeypatch.setenv('OIDC_ISSUER', ISSUER)
    monkeypatch.setattr(acces, '_cle', lambda _j: CLE.public_key())
    PDP.recus.clear()
    yield api.app.test_client()
    serveur.shutdown()


def entete(j):
    return {'Authorization': f'Bearer {j}'}


def test_la_sonde_reste_publique(client):
    assert client.get('/apercu/sante').status_code == 200


def test_refuse_sans_jeton(client):
    assert client.post('/apercu/page', json={'diapo': 1}).status_code == 401


def test_refuse_un_jeton_d_une_autre_cle(client):
    r = client.post('/apercu/page', json={'diapo': 1}, headers=entete(jeton(['trainer'], cle=AUTRE_CLE)))
    assert r.status_code == 401


def test_refuse_un_jeton_expire(client):
    r = client.post('/apercu/page', json={'diapo': 1}, headers=entete(jeton(['trainer'], exp=int(time.time()) - 10)))
    assert r.status_code == 401


def test_refuse_un_jeton_d_un_autre_emetteur(client):
    r = client.post('/apercu/page', json={'diapo': 1}, headers=entete(jeton(['trainer'], iss='http://ailleurs')))
    assert r.status_code == 401


def test_un_apprenant_est_refuse_par_cerbos(client):
    r = client.post('/apercu/redaction', json={}, headers=entete(jeton(['learner'])))
    assert r.status_code == 403
    assert PDP.recus[-1]['resources'][0]['resource']['kind'] == 'report_rendering'
    assert PDP.recus[-1]['principal']['attr']['scopeNodes'] == ['groupe.cmr.douala']


def test_un_formateur_passe_le_controle(client):
    # La diapositive n'est pas un entier : la route repond 400 apres le controle d'acces.
    r = client.post('/apercu/page', json={'diapo': 'x'}, headers=entete(jeton(['trainer'])))
    assert r.status_code == 400
    assert PDP.recus[-1]['resources'][0]['actions'] == ['render']


def test_cerbos_injoignable_vaut_refus(client, monkeypatch):
    monkeypatch.setenv('CERBOS_HTTP', 'http://127.0.0.1:9')
    r = client.post('/apercu/page', json={'diapo': 1}, headers=entete(jeton(['trainer'])))
    assert r.status_code == 403
