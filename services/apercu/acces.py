# -*- coding: utf-8 -*-
"""Controle d'acces du service de rendu (story 04-5.1).

Meme contrat que cfao-core et cfao-operations (architecture.md §5.3) :

1. le jeton Keycloak (`Authorization: Bearer`, reinjecte par le BFF) est
   valide par sa signature, via le JWKS du realm ;
2. le principal est construit comme dans cfao-core (roles, scopeNodes) ;
3. Cerbos decide de l'action sur la ressource `report_rendering`
   (policy cerbos/policies/resource_policies/report_rendering.yaml).

Toute erreur de jeton donne 401 ; tout refus ou PDP injoignable, 403.
"""
import json
import os
import urllib.request
import uuid
from functools import wraps

import jwt
from flask import jsonify, request

KIND = 'report_rendering'
_client_jwks = None


def _reglages():
    return {
        'jwks': os.environ.get('OIDC_JWKS_URL', ''),
        'issuer': os.environ.get('OIDC_ISSUER') or None,
        'audience': os.environ.get('OIDC_AUDIENCE') or None,
        'cerbos': os.environ.get('CERBOS_HTTP', 'http://localhost:3592').rstrip('/'),
    }


def _cle(jeton):
    global _client_jwks
    if _client_jwks is None:
        url = _reglages()['jwks']
        if not url:
            raise RuntimeError('OIDC_JWKS_URL non configure')
        _client_jwks = jwt.PyJWKClient(url)
    return _client_jwks.get_signing_key_from_jwt(jeton).key


def principal_du_jeton(jeton):
    """Le principal Cerbos d'un jeton valide ; leve jwt.PyJWTError sinon."""
    r = _reglages()
    options = {'require': ['exp', 'sub']}
    if not r['audience']:
        options['verify_aud'] = False
    claims = jwt.decode(jeton, _cle(jeton), algorithms=['RS256'], audience=r['audience'],
                        issuer=r['issuer'], options=options)
    noeud = claims.get('scopeNode', '')
    return {
        'id': claims['sub'],
        'roles': (claims.get('realm_access') or {}).get('roles') or ['_anon'],
        'attr': {
            'scopeNodes': [noeud] if noeud else [],
            'departments': claims.get('departments', []),
            'brands': claims.get('brands', []),
            'orgPath': claims.get('orgPath', []),
        },
    }


def autorise(principal, action):
    """Decision Cerbos ; toute erreur vaut refus (fail-closed)."""
    corps = {
        'requestId': str(uuid.uuid4()),
        'principal': principal,
        'resources': [{'resource': {'kind': KIND, 'id': 'rendu', 'attr': {}}, 'actions': [action]}],
    }
    try:
        requete = urllib.request.Request(
            f"{_reglages()['cerbos']}/api/check/resources", data=json.dumps(corps).encode(),
            headers={'content-type': 'application/json'}, method='POST')
        with urllib.request.urlopen(requete, timeout=5) as r:
            resultats = json.load(r).get('results') or [{}]
        return resultats[0].get('actions', {}).get(action) == 'EFFECT_ALLOW'
    except Exception:  # noqa: BLE001 — PDP indisponible : on refuse
        return False


def _erreur(statut, code, message):
    return jsonify({'error': {'code': code, 'message': message}}), statut


def protege(action):
    """Decorateur de route : jeton valide, puis decision Cerbos pour `action`."""
    def decorer(vue):
        @wraps(vue)
        def enveloppe(*args, **kwargs):
            entete = request.headers.get('Authorization', '')
            if not entete.startswith('Bearer '):
                return _erreur(401, 'unauthenticated', 'Jeton manquant')
            try:
                principal = principal_du_jeton(entete[7:].strip())
            except RuntimeError as e:
                return _erreur(500, 'misconfigured', str(e))
            except jwt.PyJWTError as e:
                return _erreur(401, 'invalid_token', str(e))
            if not autorise(principal, action):
                return _erreur(403, 'forbidden', 'Action non autorisée')
            return vue(*args, **kwargs)
        return enveloppe
    return decorer
