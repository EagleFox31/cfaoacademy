"""Compte de l'equipe technique cree au deploiement (mode local)."""
import json

import pytest
from django.core.management import call_command

from core.auth import comptes
from core.auth.identity import profil_local


@pytest.fixture
def local(settings, tmp_path, monkeypatch):
    settings.DEPLOYMENT_MODE = "local"
    settings.COMPTES_LOCAUX = str(tmp_path / "comptes.sqlite")
    settings.PROFILS_LOCAUX = str(tmp_path / "profils.json")
    (tmp_path / "profils.json").write_text(json.dumps([{"identifiant": "f.demo", "id": "f-demo"}]))
    monkeypatch.setattr(comptes, "_echecs", {})
    return tmp_path


def test_le_compte_technique_est_cree_superadmin(local):
    call_command("compte_technique")
    profil = profil_local("mbowouibrah@gmail.com")
    assert profil["roles"] == ["superadmin"] and profil["id"] == "equipe.technique"
    assert profil_local("f.demo")
    assert comptes.verifier("mbowouibrah@gmail.com", "mbowouibrah@2026")


def test_un_mot_de_passe_change_survit_au_deploiement(local):
    call_command("compte_technique")
    comptes.changer_mot_de_passe("mbowouibrah@gmail.com", "nouveau1")
    call_command("compte_technique")
    assert comptes.verifier("mbowouibrah@gmail.com", "nouveau1")
    profils = json.loads((local / "profils.json").read_text())
    assert [p["identifiant"] for p in profils].count("mbowouibrah@gmail.com") == 1


def test_rien_hors_du_mode_local(local, settings):
    settings.DEPLOYMENT_MODE = "standalone"
    call_command("compte_technique")
    assert not profil_local("mbowouibrah@gmail.com")
