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


# ── Le client HTTP du PDP : plusieurs ressources en une demande ────────

VRAI_LOT = cerbos.check_resources


def _ressources(n):
    return [{"kind": "session_formation", "id": str(i), "attr": {"formateurs": ["f-a"]}} for i in range(n)]


def _pdp_qui_autorise(ids_autorises, envois, inverser=False):
    def post(url, json, timeout):
        envois.append(json)
        resultats = [{"resource": {"id": r["resource"]["id"]},
                      "actions": {"read": "EFFECT_ALLOW" if r["resource"]["id"] in ids_autorises else "EFFECT_DENY"}}
                     for r in json["resources"]]
        if inverser:
            resultats.reverse()
        return SimpleNamespace(raise_for_status=lambda: None, json=lambda: {"results": resultats})
    return post


def test_check_resources_rend_une_decision_par_ressource(monkeypatch, settings):
    settings.CERBOS_HTTP = "http://pdp.invalid:3592/"
    envois = []
    monkeypatch.setattr(cerbos.requests, "post", _pdp_qui_autorise({"1"}, envois))
    decisions = VRAI_LOT(PRINCIPAL, _ressources(3), "read")
    assert decisions == {"0": False, "1": True, "2": False}
    assert len(envois) == 1
    assert [r["resource"]["id"] for r in envois[0]["resources"]] == ["0", "1", "2"]
    assert all(r["actions"] == ["read"] for r in envois[0]["resources"])
    assert envois[0]["principal"] == PRINCIPAL


def test_check_resources_apparie_par_id_et_non_par_position(monkeypatch):
    monkeypatch.setattr(cerbos.requests, "post", _pdp_qui_autorise({"0"}, [], inverser=True))
    assert VRAI_LOT(PRINCIPAL, _ressources(3), "read") == {"0": True, "1": False, "2": False}


def test_check_resources_un_resultat_sans_id_reste_refuse(monkeypatch):
    resultats = [{"resource": {"id": "0"}, "actions": {"read": "EFFECT_ALLOW"}},
                 {"actions": {"read": "EFFECT_ALLOW"}}, {"resource": {"id": "2"}, "actions": {"read": "EFFECT_ALLOW"}}]
    monkeypatch.setattr(cerbos.requests, "post", lambda *a, **k: SimpleNamespace(
        raise_for_status=lambda: None, json=lambda: {"results": resultats}))
    assert VRAI_LOT(PRINCIPAL, _ressources(3), "read") == {"0": True, "1": False, "2": True}


def test_check_resources_decoupe_par_lots_de_50(monkeypatch):
    envois = []
    monkeypatch.setattr(cerbos.requests, "post", _pdp_qui_autorise({str(i) for i in range(51)}, envois))
    decisions = VRAI_LOT(PRINCIPAL, _ressources(51), "read")
    assert [len(e["resources"]) for e in envois] == [50, 1]
    assert len(decisions) == 51 and all(decisions.values())


def test_check_resources_sans_ressource_ne_demande_rien(monkeypatch):
    envois = []
    monkeypatch.setattr(cerbos.requests, "post", _pdp_qui_autorise(set(), envois))
    assert VRAI_LOT(PRINCIPAL, [], "read") == {} and envois == []


def test_check_resources_une_panne_refuse_tout(monkeypatch):
    def post(*_a, **_k):
        raise ConnectionError("PDP injoignable")
    monkeypatch.setattr(cerbos.requests, "post", post)
    assert VRAI_LOT(PRINCIPAL, _ressources(3), "read") == {"0": False, "1": False, "2": False}


def test_check_resources_un_lot_en_echec_refuse_meme_les_lots_deja_autorises(monkeypatch):
    appels = []

    def post(url, json, timeout):
        appels.append(len(json["resources"]))
        if len(appels) == 2:
            raise TimeoutError("trop lent")
        return SimpleNamespace(raise_for_status=lambda: None,
                               json=lambda: {"results": [{"actions": {"read": "EFFECT_ALLOW"}}] * len(json["resources"])})
    monkeypatch.setattr(cerbos.requests, "post", post)
    decisions = VRAI_LOT(PRINCIPAL, _ressources(60), "read")
    assert appels == [50, 10] and len(decisions) == 60 and not any(decisions.values())


@pytest.mark.parametrize("resultats", [[], [{"actions": {"read": "EFFECT_ALLOW"}}] * 2, None, "x"],
                         ids=["vide", "trop-nombreux", "absent", "mal-forme"])
def test_check_resources_une_reponse_incoherente_refuse_tout(monkeypatch, resultats):
    monkeypatch.setattr(cerbos.requests, "post", lambda *a, **k: SimpleNamespace(
        raise_for_status=lambda: None, json=lambda: {"results": resultats}))
    assert VRAI_LOT(PRINCIPAL, _ressources(3), "read") == {"0": False, "1": False, "2": False}
