"""Client Cerbos : un incident réseau passager ne doit pas se lire comme un refus.

Cause racine (recette, 18/11) : le PDP joint par host.docker.internal répond
parfois en plus de 5 s ; check() renvoyait alors False et la liste des clés
partait en 403, sans trace dans le journal.
"""
import requests

from core.authz import cerbos

ALLOW = {"results": [{"resource": {"id": "*"}, "actions": {"list": "EFFECT_ALLOW"}}]}


class _Resp:
    def __init__(self, body):
        self._body = body

    def raise_for_status(self):
        return None

    def json(self):
        return self._body


class _Session:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0

    def post(self, url, json=None, timeout=None):
        self.calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return _Resp(outcome)


def _with(monkeypatch, session):
    monkeypatch.setattr(cerbos, "_session", lambda: session)
    return session


PRINCIPAL = {"id": "u", "roles": ["training_coordinator"], "attr": {}}


def test_un_delai_depasse_est_rejoue_une_fois(monkeypatch, caplog):
    s = _with(monkeypatch, _Session([requests.Timeout(), ALLOW]))
    assert cerbos.check(PRINCIPAL, "planning_cost_key", "*", {}, "list") is True
    assert s.calls == 2
    assert "PDP Cerbos injoignable" in caplog.text


def test_pdp_durablement_injoignable_refuse(monkeypatch):
    s = _with(monkeypatch, _Session([requests.ConnectionError(), requests.ConnectionError()]))
    assert cerbos.check(PRINCIPAL, "planning_cost_key", "*", {}, "list") is False
    assert s.calls == 2, "pas de boucle : deux essais au plus"


def test_une_erreur_http_n_est_pas_rejouee(monkeypatch):
    class _Err(_Session):
        def post(self, url, json=None, timeout=None):
            self.calls += 1
            raise requests.HTTPError("500")
    s = _with(monkeypatch, _Err([]))
    assert cerbos.check_many(PRINCIPAL, "planning_country_sheet", [("CM", {})], "view") == set()
    assert s.calls == 1
