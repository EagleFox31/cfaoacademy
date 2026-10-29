"""Smoke de la migration des comptes (fédération L5) sur un vrai Keycloak.

Même Keycloak que `smoke_realm.py`, realm appliqué :
    KC_URL=http://localhost:18080 pytest -q keycloak/tests/smoke_migration.py

Prouve, par les vrais flux de connexion, que :
- un compte needs se connecte avec son ancien mot de passe (hash argon2 repris) et garde son `sub` ;
- un compte CR garde l'id de son profil et doit changer son mot de passe temporaire ;
- une seconde exécution n'écrit rien et ne réinitialise pas un mot de passe déjà changé.
Les comptes créés sont supprimés à la fin.
"""
import base64
import json
import os

import pytest
import requests
from argon2.low_level import Type, hash_secret_raw

from smoke_realm import EMETTEURS, KC_URL, OIDC, _code_de, _connexion, _formulaire, jwt_verifier
from test_migration import m

ID_NEEDS, ID_CR = "aaaaaaaa-5e0c-4a11-9000-000000000001", "jdo-smoke"
NEEDS, ANCIEN = "chef.smoke", "ancien-mdp-needs"
CR, NOUVEAU = "j.do.smoke", "Nouveau-mdp-CR-2026"
REDIRECT = "http://localhost:8000/oauth2/callback"


def _hash_keycloak(mot_de_passe):
    """Un credential argon2 au format d'export Keycloak 26 (paramètres par défaut)."""
    sel = os.urandom(16)
    valeur = hash_secret_raw(mot_de_passe.encode(), sel, time_cost=5, memory_cost=7168,
                             parallelism=1, hash_len=32, type=Type.ID, version=19)
    b64 = lambda b: base64.b64encode(b).decode()
    return {"type": "password",
            "secretData": json.dumps({"value": b64(valeur), "salt": b64(sel), "additionalParameters": {}}),
            "credentialData": json.dumps({"hashIterations": 5, "algorithm": "argon2", "additionalParameters": {
                "hashLength": ["32"], "memory": ["7168"], "type": ["id"], "version": ["1.3"],
                "parallelism": ["1"]}})}


def _jeton(code):
    r = requests.post(f"{OIDC}/token", data={
        "grant_type": "authorization_code", "code": code, "redirect_uri": REDIRECT,
        "client_id": "cfao-portal", "client_secret": os.environ.get("CFAO_PORTAL_SECRET", "dev-portal-secret")})
    assert r.status_code == 200, r.text
    return jwt_verifier.verify(r.json()["access_token"], EMETTEURS, ("cfao-core-api",))


@pytest.fixture(scope="module")
def sources(tmp_path_factory):
    d = tmp_path_factory.mktemp("migration")
    (d / "export.json").write_text(json.dumps({"realm": "cfao-needs", "users": [{
        "id": ID_NEEDS, "username": NEEDS, "email": "chef.smoke@cfao.example", "emailVerified": True,
        "enabled": True, "firstName": "Chef", "lastName": "Smoke",
        "realmRoles": ["team_manager", "default-roles-cfao-needs"],
        "attributes": {"scopeNode": ["groupe.cmr"], "brands": ["toyota"]},
        "credentials": [_hash_keycloak(ANCIEN)]}]}), encoding="utf-8")
    (d / "profils.json").write_text(json.dumps([{
        "id": ID_CR, "identifiant": CR, "firstName": "J", "lastName": "Do", "roles": ["trainer"],
        "scopeNodes": ["CMR"], "brands": ["suzuki"], "departments": ["motors"]}]), encoding="utf-8")
    os.environ.setdefault("KC_ADMIN_PASSWORD", "admin")
    args = ["--kc-url", KC_URL, "--needs-export", str(d / "export.json"),
            "--cr-profils", str(d / "profils.json"), "--sortie-mdp", str(d / "mdp.txt")]
    kc = m.Keycloak(KC_URL, "admin", os.environ["KC_ADMIN_PASSWORD"])
    yield d, args, kc
    for ident in (ID_NEEDS, ID_CR):
        kc.s.delete(f"{KC_URL}/admin/realms/cfao/users/{ident}")


def test_a_blanc_rien_n_est_ecrit(sources):
    _, args, kc = sources
    assert m.main(args) == 0
    assert not kc.existe(ID_NEEDS) and not kc.existe(ID_CR)


def test_migration_puis_compte_needs_avec_son_ancien_mot_de_passe(sources):
    d, args, _ = sources
    assert m.main([*args, "--appliquer"]) == 0
    claims = _jeton(_code_de(_connexion("cfao-portal", REDIRECT, NEEDS, ANCIEN)[1], REDIRECT))
    assert claims["sub"] == ID_NEEDS
    assert "team_manager" in claims["realm_access"]["roles"]
    assert claims["scopeNode"] == "groupe.cmr"


def test_compte_cr_change_son_mot_de_passe_temporaire_puis_rejeu_sans_effet(sources):
    d, args, kc = sources
    (ligne,) = (d / "mdp.txt").read_text(encoding="utf-8").splitlines()
    username, temporaire = ligne.split("\t")
    assert username == CR

    s, r = _connexion("cfao-portal", REDIRECT, CR, temporaire)
    # Keycloak 26 redirige vers l'action requise au lieu de délivrer le code.
    assert r.status_code == 302 and "execution=UPDATE_PASSWORD" in r.headers["Location"], r.headers
    r = s.get(r.headers["Location"], allow_redirects=False)
    assert r.status_code == 200 and 'id="kc-passwd-update-form"' in r.text
    r = s.post(_formulaire(r, "kc-passwd-update-form"),
               data={"password-new": NOUVEAU, "password-confirm": NOUVEAU}, allow_redirects=False)
    assert _jeton(_code_de(r, REDIRECT))["sub"] == ID_CR

    # Rejeu : rien à créer, et le mot de passe choisi par la personne reste valable.
    a_creer, presents = m.planifier(kc, m.comptes_needs(json.loads((d / "export.json").read_text()))
                                    + m.comptes_cr(json.loads((d / "profils.json").read_text()))[0])
    assert (len(a_creer), len(presents)) == (0, 2)
    assert m.main([*args, "--appliquer"]) == 0
    _code_de(_connexion("cfao-portal", REDIRECT, CR, NOUVEAU)[1], REDIRECT)
    with pytest.raises(AssertionError):
        _code_de(_connexion("cfao-portal", REDIRECT, CR, temporaire)[1], REDIRECT)
