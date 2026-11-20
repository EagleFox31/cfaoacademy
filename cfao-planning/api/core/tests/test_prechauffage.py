from core.auth import jwt_verifier, prechauffage


def test_prechauffage_charge_chaque_jwks_une_fois_et_tolere_une_panne(monkeypatch):
    appels = []

    class Client:
        def __init__(self, url):
            self.url = url

        def get_jwk_set(self):
            appels.append(self.url)
            if "panne" in self.url:
                raise OSError("injoignable")

    monkeypatch.setattr(jwt_verifier, "_client", Client)
    emetteurs = {"a": "http://kc/certs", "b": "http://kc/certs", "c": "http://panne/certs"}
    assert prechauffage.prechauffer(emetteurs) == ["http://kc/certs"]
    assert appels == ["http://kc/certs", "http://panne/certs"]
