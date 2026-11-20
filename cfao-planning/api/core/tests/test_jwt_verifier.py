"""Vérification commune des jetons (core/auth/jwt_verifier.py).

Copie identique dans chaque module, comme le fichier testé. Aucun Keycloak :
une clé RSA générée ici signe les jetons, le JWKS est simulé par émetteur.
"""
import time
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from core.auth import jwt_verifier

PUBLIC = "http://localhost:8080/realms/cfao"
INTERNE = "http://keycloak:8080/realms/cfao"
JWKS = "http://keycloak:8080/realms/cfao/protocol/openid-connect/certs"
EMETTEURS = {PUBLIC: JWKS, INTERNE: JWKS}
CLE = rsa.generate_private_key(public_exponent=65537, key_size=2048)
AUTRE_CLE = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def jwks(monkeypatch):
    demandes = []

    def client(url):
        demandes.append(url)
        return SimpleNamespace(get_signing_key_from_jwt=lambda _t: SimpleNamespace(key=CLE.public_key()))

    monkeypatch.setattr(jwt_verifier, "_client", client)
    return demandes


def jeton(cle=CLE, algorithm="RS256", **claims):
    contenu = {"sub": "u-1", "iss": PUBLIC, "aud": ["cfao-needs-api", "account"],
               "exp": int(time.time()) + 300, **claims}
    return jwt.encode({k: v for k, v in contenu.items() if v is not None}, cle,
                      algorithm=algorithm, headers={"kid": "k1"})


def test_les_deux_hotes_du_realm_sont_acceptes(jwks):
    for iss in (PUBLIC, INTERNE):
        claims = jwt_verifier.verify(jeton(iss=iss), EMETTEURS, ["cfao-needs-api"])
        assert claims["iss"] == iss
    assert jwks == [JWKS, JWKS]


def test_une_audience_parmi_plusieurs_suffit():
    assert jwt_verifier.verify(jeton(), EMETTEURS, ["autre", "cfao-needs-api"])["sub"] == "u-1"


@pytest.mark.parametrize("claims", [
    {"iss": "http://ailleurs/realms/cfao"},
    {"iss": "http://localhost:8080/realms/cfao-pirate"},
    {"iss": "http://pirate/realms/cfao-needs"},
    {"iss": None},
    {"aud": "autre-client"},
    {"aud": None},
    {"exp": int(time.time()) - 10},
    {"exp": None},
    {"sub": None},
], ids=["emetteur-inconnu", "suffixe-voisin", "meme-realm-autre-hote", "sans-emetteur",
        "mauvaise-audience", "sans-audience", "expire", "sans-expiration", "sans-sujet"])
def test_un_jeton_non_conforme_est_refuse(claims, jwks):
    with pytest.raises(jwt_verifier.TokenRejected):
        jwt_verifier.verify(jeton(**claims), EMETTEURS, ["cfao-needs-api"])


def test_un_emetteur_inconnu_ne_declenche_aucun_appel_jwks(jwks):
    with pytest.raises(jwt_verifier.TokenRejected):
        jwt_verifier.verify(jeton(iss="http://ailleurs/realms/cfao"), EMETTEURS)
    assert jwks == []


def test_mauvaise_signature_refusee():
    with pytest.raises(jwt_verifier.TokenRejected):
        jwt_verifier.verify(jeton(cle=AUTRE_CLE), EMETTEURS, ["cfao-needs-api"])


def test_alg_none_et_hmac_refuses():
    contenu = {"sub": "u-1", "iss": PUBLIC, "aud": "cfao-needs-api", "exp": int(time.time()) + 300}
    for brut in (jwt.encode(contenu, None, algorithm="none"),
                 jwt.encode(contenu, "secret-partage-de-trente-deux-octets", algorithm="HS256")):
        with pytest.raises(jwt_verifier.TokenRejected):
            jwt_verifier.verify(brut, EMETTEURS, ["cfao-needs-api"])


@pytest.mark.parametrize("brut", ["pas-un-jeton", "", "a.b.c"])
def test_un_jeton_illisible_est_refuse(brut):
    with pytest.raises(jwt_verifier.TokenRejected):
        jwt_verifier.verify(brut, EMETTEURS)


def test_sans_emetteur_de_confiance_tout_est_refuse():
    with pytest.raises(jwt_verifier.TokenRejected):
        jwt_verifier.verify(jeton(), {}, ["cfao-needs-api"])


def test_sans_audience_configuree_aud_n_est_pas_verifiee():
    assert jwt_verifier.verify(jeton(aud=None), EMETTEURS)["sub"] == "u-1"


def test_configuration_des_emetteurs():
    brut = f" {PUBLIC} = {JWKS} ;\n{INTERNE}={JWKS};"
    assert jwt_verifier.trusted_issuers(brut) == EMETTEURS
    # Le couple historique OIDC_ISSUER / OIDC_JWKS_URL s'ajoute.
    assert jwt_verifier.trusted_issuers("", INTERNE, JWKS) == {INTERNE: JWKS}
    assert jwt_verifier.trusted_issuers(f"{PUBLIC}={JWKS}", INTERNE, JWKS) == EMETTEURS
    assert jwt_verifier.trusted_issuers("", INTERNE, "") == {}
    with pytest.raises(ValueError):
        jwt_verifier.trusted_issuers("http://sans-jwks")


def test_configuration_des_audiences():
    assert jwt_verifier.audiences(" a, b ,,") == ("a", "b")
    assert jwt_verifier.audiences("") == ()
