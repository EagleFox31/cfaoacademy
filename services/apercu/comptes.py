# -*- coding: utf-8 -*-
"""Comptes des formateurs et sessions de connexion.

Chaque formateur a son compte : un identifiant, un mot de passe (seule
son empreinte est gardee) et son profil, celui que le portail affiche.
Le profil reste dans la base, hors du depot : il porte un vrai nom.

Une connexion ouvre une session : un jeton aleatoire remis au navigateur
dans un cookie `HttpOnly` ; la base n'en garde que l'empreinte. « Se
souvenir de moi » la fait durer trente jours, sinon elle s'arrete a la
fermeture du navigateur (et au plus tard apres douze heures).

A terme, Keycloak prend le relais (voir `docs/adr`) : tout passe par ce
module et par les trois routes `/cr-donnees/connexion|session|deconnexion`.

Creer ou modifier un compte, depuis la racine du depot :

    python services/apercu/comptes.py creer <identifiant> <profil.json>
    python services/apercu/comptes.py mot-de-passe <identifiant>
    python services/apercu/comptes.py liste
"""
import hashlib
import json
import secrets
import sqlite3
import sys
import threading
import time
from pathlib import Path

from werkzeug.security import check_password_hash, generate_password_hash

import stockage

DONNEES = Path(__file__).resolve().parent / 'donnees'
BASE = DONNEES / 'comptes.sqlite'
DUREE_PERSISTANTE = 30 * 24 * 3600
DUREE_NAVIGATEUR = 12 * 3600
# Apres cinq echecs, un identifiant attend une minute avant de reessayer.
ECHECS_MAX, ATTENTE = 5, 60

_verrou = threading.Lock()
_echecs = {}


def _connexion():
    DONNEES.mkdir(parents=True, exist_ok=True)
    cx = sqlite3.connect(BASE)
    cx.execute(
        'CREATE TABLE IF NOT EXISTS comptes ('
        ' identifiant TEXT PRIMARY KEY, empreinte TEXT NOT NULL, profil TEXT NOT NULL)')
    cx.execute(
        'CREATE TABLE IF NOT EXISTS sessions ('
        ' jeton TEXT PRIMARY KEY, identifiant TEXT NOT NULL, expire_le REAL NOT NULL)')
    return cx


def _empreinte_jeton(jeton):
    return hashlib.sha256(jeton.encode()).hexdigest()


def enregistrer(identifiant, mot_de_passe, profil):
    """Cree le compte, ou remplace son mot de passe et son profil."""
    identifiant = identifiant.strip().lower()
    if not stockage.valide(identifiant) or not stockage.valide(profil.get('id')):
        raise ValueError('identifiant ou id de profil invalide')
    if len(mot_de_passe) < 8:
        raise ValueError('mot de passe de 8 caracteres au moins')
    profil = {**profil, 'compte': True}
    with _verrou, _connexion() as cx:
        cx.execute(
            'INSERT INTO comptes (identifiant, empreinte, profil) VALUES (?, ?, ?) '
            'ON CONFLICT (identifiant) DO UPDATE SET empreinte = excluded.empreinte, '
            'profil = excluded.profil',
            (identifiant, generate_password_hash(mot_de_passe), json.dumps(profil, ensure_ascii=False)))


def changer_mot_de_passe(identifiant, mot_de_passe):
    """Nouveau mot de passe ; les sessions ouvertes sont fermees."""
    if len(mot_de_passe) < 8:
        raise ValueError('mot de passe de 8 caracteres au moins')
    with _verrou, _connexion() as cx:
        n = cx.execute('UPDATE comptes SET empreinte = ? WHERE identifiant = ?',
                       (generate_password_hash(mot_de_passe), identifiant)).rowcount
        cx.execute('DELETE FROM sessions WHERE identifiant = ?', (identifiant,))
    if not n:
        raise KeyError(identifiant)


def verifier(identifiant, mot_de_passe):
    """Le profil du compte si le mot de passe est le bon, sinon None.

    Leve PermissionError tant qu'un identifiant trop souvent refuse attend.
    """
    identifiant = (identifiant or '').strip().lower()
    maintenant = time.time()
    with _verrou:
        n, depuis = _echecs.get(identifiant, (0, 0))
        if n >= ECHECS_MAX and maintenant - depuis < ATTENTE:
            raise PermissionError(identifiant)
        with _connexion() as cx:
            ligne = cx.execute('SELECT empreinte, profil FROM comptes WHERE identifiant = ?',
                               (identifiant,)).fetchone()
        if ligne and check_password_hash(ligne[0], mot_de_passe or ''):
            _echecs.pop(identifiant, None)
            return json.loads(ligne[1])
        _echecs[identifiant] = (0 if n >= ECHECS_MAX else n) + 1, maintenant
    return None


def ouvrir_session(identifiant, persistante):
    """Un nouveau jeton de session ; les sessions echues sont purgees."""
    jeton = secrets.token_urlsafe(32)
    duree = DUREE_PERSISTANTE if persistante else DUREE_NAVIGATEUR
    with _verrou, _connexion() as cx:
        cx.execute('DELETE FROM sessions WHERE expire_le < ?', (time.time(),))
        cx.execute('INSERT INTO sessions (jeton, identifiant, expire_le) VALUES (?, ?, ?)',
                   (_empreinte_jeton(jeton), identifiant.strip().lower(), time.time() + duree))
    return jeton, duree


def profil_de(jeton):
    """Le profil du compte connecte par ce jeton, ou None."""
    if not jeton:
        return None
    with _connexion() as cx:
        ligne = cx.execute(
            'SELECT c.profil FROM sessions s JOIN comptes c ON c.identifiant = s.identifiant '
            'WHERE s.jeton = ? AND s.expire_le > ?',
            (_empreinte_jeton(jeton), time.time())).fetchone()
    return json.loads(ligne[0]) if ligne else None


def fermer_session(jeton):
    if jeton:
        with _verrou, _connexion() as cx:
            cx.execute('DELETE FROM sessions WHERE jeton = ?', (_empreinte_jeton(jeton),))


def _mot_de_passe_genere():
    return secrets.token_urlsafe(9)


if __name__ == '__main__':
    commande = sys.argv[1] if len(sys.argv) > 1 else ''
    if commande == 'creer' and len(sys.argv) == 4:
        profil = json.loads(Path(sys.argv[3]).read_text(encoding='utf-8'))
        mdp = _mot_de_passe_genere()
        enregistrer(sys.argv[2], mdp, profil)
        print(f'compte {sys.argv[2].lower()} pret, mot de passe : {mdp}')
    elif commande == 'mot-de-passe' and len(sys.argv) == 3:
        mdp = _mot_de_passe_genere()
        changer_mot_de_passe(sys.argv[2].lower(), mdp)
        print(f'nouveau mot de passe de {sys.argv[2].lower()} : {mdp}')
    elif commande == 'liste':
        with _connexion() as cx:
            for identifiant, profil in cx.execute('SELECT identifiant, profil FROM comptes'):
                p = json.loads(profil)
                print(identifiant, p.get('id'), p.get('roles'))
    else:
        print(__doc__)
        sys.exit(2)
