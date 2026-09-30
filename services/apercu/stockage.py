# -*- coding: utf-8 -*-
"""Conservation des comptes rendus en cours, cote serveur.

Solution de demarrage : une base SQLite et un dossier de photos a cote du
service d'apercu, pour qu'un formateur retrouve ses saisies sur n'importe
quel poste du reseau. A terme, ce stockage rejoint `cfao-core` (Django,
PostgreSQL, Keycloak, Cerbos) : tout passe par ce module, qu'il suffira
de remplacer, et le contrat HTTP (`/cr-donnees/...`) restera le meme.

Un brouillon est un document JSON opaque, range sous (utilisateur, id).
L'utilisateur est l'id du profil connecte (voir `comptes.py`) : l'interface
ne peut pas le choisir, il vient de la session.
"""
import json
import re
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

DONNEES = Path(__file__).resolve().parent / 'donnees'
BASE = DONNEES / 'comptes-rendus.sqlite'

_verrou = threading.Lock()
_IDENT = re.compile(r'[A-Za-z0-9._-]{1,80}')


def valide(ident):
    """Un identifiant sur : ni chemin, ni caractere de controle."""
    return bool(ident) and bool(_IDENT.fullmatch(str(ident)))


def _connexion():
    DONNEES.mkdir(parents=True, exist_ok=True)
    cx = sqlite3.connect(BASE)
    cx.execute(
        'CREATE TABLE IF NOT EXISTS brouillons ('
        ' utilisateur TEXT NOT NULL, id TEXT NOT NULL, contenu TEXT NOT NULL,'
        ' modifie_le TEXT NOT NULL, PRIMARY KEY (utilisateur, id))')
    # Les suppressions sont gardees : sans elles, un poste qui garde une
    # copie du brouillon le ferait revenir a sa prochaine synchronisation.
    cx.execute(
        'CREATE TABLE IF NOT EXISTS supprimes ('
        ' utilisateur TEXT NOT NULL, id TEXT NOT NULL, le TEXT NOT NULL,'
        ' PRIMARY KEY (utilisateur, id))')
    return cx


def _maintenant():
    """L'instant present, au format des dates du navigateur (ISO, en Z)."""
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def lister(utilisateur):
    """Les brouillons d'un utilisateur, du plus recent au plus ancien,
    et les suppressions (id -> date) pour que chaque poste les applique."""
    with _verrou, _connexion() as cx:
        lignes = cx.execute(
            'SELECT contenu FROM brouillons WHERE utilisateur = ? '
            'ORDER BY modifie_le DESC', (utilisateur,)).fetchall()
        supprimes = cx.execute(
            'SELECT id, le FROM supprimes WHERE utilisateur = ?', (utilisateur,)).fetchall()
    return [json.loads(c) for (c,) in lignes], dict(supprimes)


def lire(utilisateur, ident):
    with _verrou, _connexion() as cx:
        ligne = cx.execute(
            'SELECT contenu FROM brouillons WHERE utilisateur = ? AND id = ?',
            (utilisateur, ident)).fetchone()
    return json.loads(ligne[0]) if ligne else None


def ecrire(utilisateur, ident, contenu):
    """Enregistre le brouillon ; la version la plus recente l'emporte.

    Deux postes ouverts sur le meme compte rendu : une ecriture plus
    ancienne que celle deja conservee est ignoree, et la version gardee
    est renvoyee pour que l'appelant se remette a jour.
    """
    contenu = dict(contenu)
    contenu.setdefault('modifieLe', _maintenant())
    with _verrou, _connexion() as cx:
        # Supprime ailleurs apres cette version : on ne le ressuscite pas.
        supprime = cx.execute(
            'SELECT le FROM supprimes WHERE utilisateur = ? AND id = ?',
            (utilisateur, ident)).fetchone()
        if supprime and supprime[0] >= contenu['modifieLe']:
            return None, False
        cx.execute('DELETE FROM supprimes WHERE utilisateur = ? AND id = ?',
                   (utilisateur, ident))
        actuel = cx.execute(
            'SELECT contenu, modifie_le FROM brouillons WHERE utilisateur = ? AND id = ?',
            (utilisateur, ident)).fetchone()
        if actuel and actuel[1] > contenu['modifieLe']:
            return json.loads(actuel[0]), False
        cx.execute(
            'INSERT INTO brouillons (utilisateur, id, contenu, modifie_le) VALUES (?, ?, ?, ?) '
            'ON CONFLICT (utilisateur, id) DO UPDATE SET contenu = excluded.contenu, '
            'modifie_le = excluded.modifie_le',
            (utilisateur, ident, json.dumps(contenu, ensure_ascii=False), contenu['modifieLe']))
    return contenu, True


def supprimer(utilisateur, ident):
    with _verrou, _connexion() as cx:
        cx.execute('DELETE FROM brouillons WHERE utilisateur = ? AND id = ?',
                   (utilisateur, ident))
        cx.execute(
            'INSERT INTO supprimes (utilisateur, id, le) VALUES (?, ?, ?) '
            'ON CONFLICT (utilisateur, id) DO UPDATE SET le = excluded.le',
            (utilisateur, ident, _maintenant()))
