"""Le PEP : chaque route demande au PDP, et un refus ou une panne vaut 403."""
import io
from types import SimpleNamespace

import pytest
from PIL import Image

from core.authz import cerbos

# Le vrai client, garde avant que la fixture `pdp` ne le remplace.
VRAI_CHECK = cerbos.check_permission

BROUILLON = {"meta": {"marque": "toyota"}, "titre": "Session d'essai"}


@pytest.mark.parametrize("methode, adresse, corps, kind, action", [
    ("get", "/cr-donnees/brouillons", None, "compte_rendu", "list"),
    ("put", "/cr-donnees/brouillons/b1", BROUILLON, "compte_rendu", "create"),
    ("post", "/apercu/page", {}, "compte_rendu_rendu", "render"),
    ("post", "/apercu/document", {}, "compte_rendu_rendu", "render"),
    ("post", "/apercu/rapport", {}, "compte_rendu_rendu", "render"),
    ("post", "/apercu/rapports", {}, "compte_rendu_rendu", "render"),
    ("post", "/apercu/redaction", {}, "compte_rendu_rendu", "redact"),
])
def test_chaque_route_passe_par_le_pdp_et_un_refus_donne_403(
        client, pdp, methode, adresse, corps, kind, action):
    pdp.reponse = False
    r = getattr(client(), methode)(adresse, corps, format="json")
    assert r.status_code == 403
    assert (pdp.demandes[-1]["kind"], pdp.demandes[-1]["action"]) == (kind, action)


def test_lire_modifier_supprimer_portent_le_proprietaire(client, pdp):
    c = client("f-a")
    c.put("/cr-donnees/brouillons/b1", BROUILLON, format="json")
    c.get("/cr-donnees/brouillons/b1")
    c.put("/cr-donnees/brouillons/b1", BROUILLON, format="json")
    c.delete("/cr-donnees/brouillons/b1")
    actions = [(d["action"], d["attr"]["ownerId"]) for d in pdp.demandes]
    assert actions == [("create", "f-a"), ("read", "f-a"), ("update", "f-a"), ("delete", "f-a")]


def test_un_refus_en_lecture_donne_403(client, pdp):
    c = client()
    c.put("/cr-donnees/brouillons/b1", BROUILLON, format="json")
    pdp.reponse = lambda _p, _r, action: action != "read"
    assert c.get("/cr-donnees/brouillons/b1").status_code == 403


def test_l_envoi_d_une_photo_est_soumis_au_pdp(client, pdp):
    pdp.reponse = False
    r = client().post("/apercu/photo", data=b"\xff\xd8\xff", content_type="image/jpeg")
    assert r.status_code in (400, 403)
    if r.status_code == 403:
        assert pdp.demandes[-1]["kind"] == "compte_rendu_photo"


# ── Le client HTTP du PDP ──────────────────────────────────────────────

PRINCIPAL = {"id": "f-a", "roles": ["trainer"], "attr": {"scopeNodes": []}}
RESSOURCE = {"kind": "compte_rendu", "id": "b1", "attr": {"ownerId": "f-a"}}


def _reponse(effet):
    return SimpleNamespace(raise_for_status=lambda: None,
                           json=lambda: {"results": [{"actions": {"read": effet}}]})


def test_le_pdp_est_interroge_sur_l_api_check_resources(monkeypatch, settings):
    settings.CERBOS_HTTP = "http://pdp.invalid:3592/"
    envois = []
    monkeypatch.setattr(cerbos.requests, "post",
                        lambda url, json, timeout: envois.append((url, json)) or _reponse("EFFECT_ALLOW"))
    assert VRAI_CHECK(PRINCIPAL, RESSOURCE, "read") is True
    url, corps = envois[0]
    assert url == "http://pdp.invalid:3592/api/check/resources"
    assert corps["principal"] == PRINCIPAL
    assert corps["resources"][0] == {"resource": RESSOURCE, "actions": ["read"]}


def test_un_refus_explicite_vaut_false(monkeypatch):
    monkeypatch.setattr(cerbos.requests, "post", lambda *a, **k: _reponse("EFFECT_DENY"))
    assert VRAI_CHECK(PRINCIPAL, RESSOURCE, "read") is False


@pytest.mark.parametrize("panne", [
    ConnectionError("PDP injoignable"),
    SimpleNamespace(raise_for_status=lambda: None, json=lambda: {}),
    SimpleNamespace(raise_for_status=lambda: None, json=lambda: {"results": []}),
], ids=["injoignable", "reponse-vide", "sans-resultat"])
def test_une_panne_du_pdp_vaut_refus(monkeypatch, panne):
    def post(*_a, **_k):
        if isinstance(panne, Exception):
            raise panne
        return panne
    monkeypatch.setattr(cerbos.requests, "post", post)
    assert VRAI_CHECK(PRINCIPAL, RESSOURCE, "read") is False


def test_un_principal_sans_role_est_presente_comme_anonyme(monkeypatch):
    envois = []
    monkeypatch.setattr(cerbos.requests, "post",
                        lambda url, json, timeout: envois.append(json) or _reponse("EFFECT_DENY"))
    VRAI_CHECK({"id": "x", "roles": []}, RESSOURCE, "read")
    assert envois[0]["principal"]["roles"] == ["_anon"]
