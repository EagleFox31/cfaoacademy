"""Correspondance des comptes de module vers le realm `cfao` (fédération L5), sans Keycloak."""
import importlib.util
from pathlib import Path

import pytest

_spec = importlib.util.spec_from_file_location(
    "migrer_comptes", Path(__file__).resolve().parents[1] / "migration" / "migrer_comptes.py")
m = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m)

HASH = {"type": "password", "secretData": '{"value":"x","salt":"y"}',
        "credentialData": '{"hashIterations":5,"algorithm":"argon2"}'}


def _export(*users):
    return {"realm": "cfao-needs", "users": list(users)}


def _needs(ident="aaaaaaaa-0000-0000-0000-000000000001", **extra):
    return {"id": ident, "username": "Chef.Equipe", "email": "chef@cfao.example", "enabled": True,
            "realmRoles": ["team_manager", "default-roles-cfao-needs", "offline_access"],
            "attributes": {"scopeNode": ["groupe.cmr"], "brands": ["toyota"], "interne": ["x"]},
            "credentials": [HASH, {"type": "otp"}], **extra}


def _profil(ident="jdo", **extra):
    return {"id": ident, "identifiant": "J.Do", "firstName": "J", "lastName": "Do", "roles": ["trainer"],
            "scopeNodes": ["CMR"], "brands": ["toyota"], "departments": ["motors"], **extra}


def test_needs_garde_id_et_hash_sans_roles_techniques():
    (c,) = m.comptes_needs(_export(_needs()))
    assert c["id"] == "aaaaaaaa-0000-0000-0000-000000000001"
    assert c["username"] == "chef.equipe"
    assert c["realmRoles"] == ["team_manager"]
    assert c["credentials"] == [HASH]          # le hash est repris, l'OTP non
    assert set(c["attributes"]) == {"scopeNode", "brands"}


def test_needs_ignore_les_comptes_de_service():
    assert m.comptes_needs(_export(_needs(serviceAccountClientId="needs-api"))) == []


def test_cr_garde_l_id_du_profil_et_force_le_changement_de_mot_de_passe():
    (c,), mdp = m.comptes_cr([_profil()], generer=lambda: "tmp-123")
    assert c["id"] == "jdo" and c["username"] == "j.do"
    assert c["credentials"] == [{"type": "password", "value": "tmp-123", "temporary": True}]
    assert c["requiredActions"] == ["UPDATE_PASSWORD"]
    assert c["attributes"]["scopeNode"] == ["CMR"]
    assert mdp == {"j.do": "tmp-123"}


def test_cr_mots_de_passe_aleatoires_et_distincts():
    _, mdp = m.comptes_cr([_profil(), _profil("abc", identifiant="a.bc")])
    assert len(set(mdp.values())) == 2 and all(len(v) >= 16 for v in mdp.values())


@pytest.mark.parametrize("noeuds", [[], ["CMR", "GAB"]])
def test_cr_refuse_un_perimetre_ambigu(noeuds):
    with pytest.raises(m.MigrationRefusee):
        m.comptes_cr([_profil(scopeNodes=noeuds)])


def test_refuse_une_personne_en_double_entre_modules():
    needs = m.comptes_needs(_export(_needs()))
    cr, _ = m.comptes_cr([_profil(identifiant="chef.equipe")])
    with pytest.raises(m.MigrationRefusee, match="username en double"):
        m.verifier(needs + cr, {"team_manager", "trainer"})


def test_refuse_un_email_en_double_sans_tenir_compte_de_la_casse():
    a = m.comptes_needs(_export(_needs()))
    b = m.comptes_needs(_export(_needs("bbbbbbbb-0000-0000-0000-000000000002",
                                       username="autre", email="CHEF@cfao.example")))
    with pytest.raises(m.MigrationRefusee, match="email en double"):
        m.verifier(a + b, {"team_manager"})


def test_refuse_un_role_absent_du_realm():
    with pytest.raises(m.MigrationRefusee, match="rôles absents"):
        m.verifier(m.comptes_needs(_export(_needs())), {"trainer"})


def test_sans_email_pas_de_faux_doublon():
    cr, _ = m.comptes_cr([_profil(), _profil("abc", identifiant="a.bc")])
    m.verifier(cr, {"trainer"})


def test_le_fichier_des_mots_de_passe_n_est_pas_lisible_par_autrui(tmp_path):
    chemin = tmp_path / "mdp.txt"
    m._ecrire_mots_de_passe(chemin, {"j.do": "tmp"})
    assert chemin.read_text(encoding="utf-8") == "j.do\ttmp\n"
    if hasattr(__import__("os"), "geteuid"):
        assert chemin.stat().st_mode & 0o077 == 0
