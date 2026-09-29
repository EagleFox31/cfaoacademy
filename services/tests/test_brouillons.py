"""Export de l'ancien stockage SQLite des brouillons, vers cfao-operations.

La base est creee dans un dossier temporaire, jamais dans `donnees/`.
"""
import json
import sqlite3

import api
from exporter_brouillons import exporter


def base_ancienne(chemin):
    cx = sqlite3.connect(chemin)
    cx.execute('CREATE TABLE brouillons (utilisateur TEXT, id TEXT, contenu TEXT, modifie_le TEXT)')
    cx.execute('CREATE TABLE supprimes (utilisateur TEXT, id TEXT, le TEXT)')
    cx.execute('INSERT INTO brouillons VALUES (?, ?, ?, ?)',
               ('u10', 'manuel-1', json.dumps({'intitule': 'Essai'}), '2026-09-01T10:00:00.000Z'))
    cx.execute('INSERT INTO supprimes VALUES (?, ?, ?)', ('u10', 'manuel-0', '2026-08-01T10:00:00.000Z'))
    cx.commit()
    cx.close()


def test_exporte_brouillons_et_suppressions(tmp_path):
    base = tmp_path / 'ancienne.sqlite'
    base_ancienne(base)
    sortie = exporter(base)
    assert sortie['brouillons'] == [{'compte': 'u10', 'id': 'manuel-1', 'contenu': {'intitule': 'Essai'},
                                     'modifieLe': '2026-09-01T10:00:00.000Z'}]
    assert sortie['supprimes'] == [{'compte': 'u10', 'id': 'manuel-0', 'le': '2026-08-01T10:00:00.000Z'}]


def test_le_service_de_rendu_ne_sert_plus_les_brouillons():
    client = api.app.test_client()
    assert client.get('/cr-donnees/brouillons', headers={'X-Utilisateur': 'u10'}).status_code == 404
