"""Lien fiche formateur ↔ compte, et comptes formateurs à créer."""
import json
import uuid
from io import StringIO

import pytest
from django.core.cache import cache
from django.core.management import call_command

from referential.models import Trainer, TrainerAlias
from referential.normalize import norm_key
from referential.trainer_accounts import account_profiles, link_trainer_account

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _cache_vide():
    cache.clear()
    yield
    cache.clear()


def _fiche(name, **extra):
    return Trainer.objects.create(full_name=name, name_norm=norm_key(name), service="MOTORS", **extra)


def _claims(**kw):
    return {"given_name": "", "family_name": "", **kw}


def test_relie_par_nom_et_pose_l_email():
    fiche = _fiche("Eugène EBENE")
    sub = str(uuid.uuid4())
    assert link_trainer_account(sub, _claims(given_name="Eugene", family_name="Ebene",
                                             email="e.ebene@exemple.test"), ["trainer"]) == fiche
    fiche.refresh_from_db()
    assert (fiche.keycloak_sub, fiche.email) == (sub, "e.ebene@exemple.test")


def test_relie_par_identifiant_de_la_fiche():
    fiche = _fiche("Lucien GAGNE")
    link_trainer_account(str(fiche.pk), _claims(), ["trainer"])
    fiche.refresh_from_db()
    assert fiche.keycloak_sub == str(fiche.pk)


def test_relie_par_alias_et_par_identifiant_prenom_nom():
    fiche = _fiche("Thierry TAMO")
    TrainerAlias.objects.create(alias_norm="TITI", trainer=fiche)
    link_trainer_account("sub-1", _claims(preferred_username="titi"), ["trainer"])
    fiche.refresh_from_db()
    assert fiche.keycloak_sub == "sub-1"


def test_jamais_d_ecrasement_ni_de_double_lien():
    fiche = _fiche("Eugène EBENE", keycloak_sub="deja-relie")
    assert link_trainer_account("autre", _claims(name="Eugene Ebene"), ["trainer"]) is None
    fiche.refresh_from_db()
    assert fiche.keycloak_sub == "deja-relie"
    # Un compte déjà relié ne prend pas une seconde fiche.
    _fiche("Eugène EBENE BIS")
    assert link_trainer_account("deja-relie", _claims(name="Eugene Ebene Bis"), ["trainer"]) is None


def test_ambigu_ou_hors_role_formateur_rien():
    a, b = _fiche("Paul MBA"), _fiche("Paul MBA NDONG")
    TrainerAlias.objects.create(alias_norm="PAUL", trainer=a)
    TrainerAlias.objects.create(alias_norm="PAUL MBA NDONG", trainer=b)
    # « PAUL MBA » (nom) et « PAUL » (identifiant, alias de a) → a seul : relié.
    assert link_trainer_account("s1", _claims(name="Paul Mba", preferred_username="paul"), ["trainer"]) == a
    # Un coordinateur homonyme n'est jamais relié.
    _fiche("Jean OWONA")
    assert link_trainer_account("s2", _claims(name="Jean Owona"), ["training_coordinator"]) is None
    assert not Trainer.objects.filter(keycloak_sub="s2").exists()


def test_deux_fiches_possibles_rien():
    _fiche("Alain NGUEMA")
    other = _fiche("Alain NGUEMA ESSONO")
    TrainerAlias.objects.create(alias_norm="ALAIN NGUEMA X", trainer=other)
    claims = _claims(given_name="Alain", family_name="Nguema", preferred_username="alain.nguema.x")
    assert link_trainer_account("s3", claims, ["trainer"]) is None


def _authentifier(monkeypatch, claims):
    from rest_framework.test import APIRequestFactory

    from core.auth import jwt_verifier
    from core.auth.oidc import KeycloakJWTAuthentication

    monkeypatch.setattr(jwt_verifier, "verify", lambda *a, **k: claims)
    request = APIRequestFactory().get("/", HTTP_AUTHORIZATION="Bearer x")
    return KeycloakJWTAuthentication().authenticate(request)[0]


def test_connexion_d_un_formateur_pose_le_lien(monkeypatch):
    fiche = _fiche("Eugène EBENE")
    principal = _authentifier(monkeypatch, {"sub": "s-auth", "realm_access": {"roles": ["trainer"]},
                                            "given_name": "Eugène", "family_name": "EBENE"})
    fiche.refresh_from_db()
    assert (principal.id, fiche.keycloak_sub) == ("s-auth", "s-auth")


def test_un_echec_du_lien_n_empeche_pas_la_connexion(monkeypatch):
    import referential.trainer_accounts as ta

    monkeypatch.setattr(ta, "link_trainer_account", lambda *a: 1 / 0)
    principal = _authentifier(monkeypatch, {"sub": "s-x", "realm_access": {"roles": ["trainer"]}})
    assert principal.id == "s-x"


def test_comptes_a_creer_sans_doublon_avec_les_comptes_rendus():
    _fiche("Eugène EBENE")
    _fiche("Lucien GAGNE")
    _fiche("Ext ERNE", is_external=True)
    _fiche("Tech NICIEN", kind=Trainer.Kind.TECH_INSTRUCTOR)
    _fiche("Deja RELIE", keycloak_sub="x")
    cr = [{"id": "cr-1", "identifiant": "lgagne", "firstName": "Lucien", "lastName": "Gagne",
           "roles": ["trainer"], "scopeNodes": ["groupe.cmr"]}]
    out = StringIO()
    call_command("export_trainer_accounts", stdout=out, avec=None)
    assert {p["identifiant"] for p in json.loads(out.getvalue())} == {"eugene.ebene", "lucien.gagne"}
    profils = account_profiles(cr)
    assert [(p["identifiant"], p["roles"], p["scopeNodes"]) for p in profils] == [
        ("eugene.ebene", ["trainer"], ["groupe.cmr"])]


def test_scope_node_au_format_orgpath_jamais_un_code_nu():
    from referential.models import Country

    sen = Country.objects.create(code="sen", label="Sénégal", org_path=["groupe", "groupe.sen"])
    civ = Country.objects.create(code="CIV", label="Côte d'Ivoire")  # orgPath non renseigné
    _fiche("Alpha SENE", home_country=sen)
    _fiche("Bravo IVOIRE", home_country=civ)
    _fiche("Charlie DOUALA")
    scopes = {p["identifiant"]: p["scopeNodes"] for p in account_profiles([])}
    assert scopes == {"alpha.sene": ["groupe.sen"], "bravo.ivoire": ["groupe.civ"],
                      "charlie.douala": ["groupe.cmr"]}
