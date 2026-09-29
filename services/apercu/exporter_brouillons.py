# -*- coding: utf-8 -*-
"""Exporte les brouillons de l'ancien stockage SQLite, pour cfao-operations.

Jusqu'a la story 04-5.2, le service de rendu gardait les brouillons dans
`donnees/comptes-rendus.sqlite`, sous l'identifiant du compte de
demonstration. Ils vivent desormais dans ops-db. Ce script les sort en JSON,
tels quels, en lecture seule ; `cfao-operations` les importe ensuite
(`npm run importer:brouillons`) en associant chaque compte a son sub Keycloak.

Usage :
    python exporter_brouillons.py [base.sqlite] > brouillons.json
"""
import json
import sqlite3
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent / 'donnees' / 'comptes-rendus.sqlite'


def exporter(base=BASE):
    """Les brouillons et les suppressions, par compte de l'ancien stockage."""
    cx = sqlite3.connect(f'file:{Path(base).as_posix()}?mode=ro', uri=True)
    try:
        brouillons = [
            {'compte': u, 'id': i, 'contenu': json.loads(c), 'modifieLe': m}
            for u, i, c, m in cx.execute(
                'SELECT utilisateur, id, contenu, modifie_le FROM brouillons ORDER BY utilisateur, id')]
        supprimes = [
            {'compte': u, 'id': i, 'le': le}
            for u, i, le in cx.execute('SELECT utilisateur, id, le FROM supprimes ORDER BY utilisateur, id')]
    finally:
        cx.close()
    return {'brouillons': brouillons, 'supprimes': supprimes}


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    json.dump(exporter(sys.argv[1] if len(sys.argv) > 1 else BASE), sys.stdout, ensure_ascii=False, indent=1)
