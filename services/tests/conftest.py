"""Les modules des services s'importent comme au demarrage de `api.py`."""
import sys
from pathlib import Path

SERVICES = Path(__file__).resolve().parents[1]
for dossier in ('apercu', 'redaction'):
    sys.path.insert(0, str(SERVICES / dossier))

import pytest  # noqa: E402

import api  # noqa: E402
import comptes  # noqa: E402
import photos  # noqa: E402
import stockage  # noqa: E402


@pytest.fixture(autouse=True)
def bases_temporaires(tmp_path, monkeypatch):
    """Comptes, brouillons et photos dans des dossiers temporaires, jamais dans `donnees/`."""
    monkeypatch.setattr(photos, 'PERMANENT', tmp_path / 'photos')
    monkeypatch.setattr(stockage, 'DONNEES', tmp_path)
    monkeypatch.setattr(stockage, 'BASE', tmp_path / 'brouillons.sqlite')
    monkeypatch.setattr(comptes, 'DONNEES', tmp_path)
    monkeypatch.setattr(comptes, 'BASE', tmp_path / 'comptes.sqlite')
    monkeypatch.setattr(comptes, '_echecs', {})


@pytest.fixture
def connecte():
    """Un client connecte a un compte d'essai (cree au besoin)."""
    def ouvrir(identifiant='formateur.essai', id_profil='f-essai'):
        comptes.enregistrer(identifiant, 'mot-de-passe-essai',
                            {'id': id_profil, 'roles': ['trainer'], 'firstName': 'Essai'})
        client = api.app.test_client()
        r = client.post('/cr-donnees/connexion',
                        json={'identifiant': identifiant, 'motDePasse': 'mot-de-passe-essai'})
        assert r.status_code == 200
        return client
    return ouvrir
