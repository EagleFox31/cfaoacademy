"""Contrat consommateur `cr-sessions` : copie locale des sessions du planning.

Le planning est simule ; ses reponses sont validees contre la spec publiee par
le fournisseur (`cfao-planning/api/planning/contract/cr-sessions.openapi.json`).
"""
import copy
import sys
from pathlib import Path

import pytest
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "contracts"))

import kit  # noqa: E402

from comptes_rendus import planning  # noqa: E402
from comptes_rendus.models import Animation, Formation, Session  # noqa: E402

SPEC = kit.load_spec("cr-sessions")
URL = "http://planning-api:8000"
CLE = "cle-de-test"


def session_planning(**champs):
    """L'exemple du contrat, reecrit : formateurs fictifs des profils de test."""
    s = copy.deepcopy(kit.response_example(SPEC, planning.PATH)["sessions"][0])
    s.update({"id": "7d0c5b1e-2f4a-4c1b-9a43-1f6c2b7e9d10", "code": "PLN-201", "title": "Climatisation fictive",
              "location": "Douala", "start_date": "2026-11-02", "end_date": "2026-11-06",
              "country": {"code": "CM", "label": "Cameroun"}, "brand": {"code": "TOYOTA", "label": "Toyota"},
              "trainers": [{"id": "5a1e9c2d-0b7f-4e3a-9d21-6c8f4b2a7e01", "name": "Marie FICTIVE", "kind": "TRAINER", "is_external": False,
                            "sub": "sub-marie"},
                           {"id": "5a1e9c2d-0b7f-4e3a-9d21-6c8f4b2a7e02", "name": "Jean INCONNU", "kind": "TRAINER", "is_external": True,
                            "sub": None}],
              "revision": "r1"})
    s.update(champs)
    return s


def corps(*sessions):
    body = {"revision": "liste-" + "-".join(s["revision"] for s in sessions),
            "window": {"ended_from": "2026-09-21", "ended_to": "2026-11-20"}, "sessions": list(sessions)}
    assert [e.message for e in kit.response_validator(SPEC, planning.PATH, 200).iter_errors(body)] == []
    return body


class FauxPlanning:
    """Remplace `requests.get` : garde les appels, rend la reponse programmee."""

    def __init__(self):
        self.appels, self.body, self.status, self.erreur = [], None, 200, None

    def __call__(self, url, params=None, headers=None, timeout=None):
        self.appels.append({"url": url, "params": params, "headers": headers, "timeout": timeout})
        if self.erreur:
            raise self.erreur
        etag = f'"{self.body["revision"]}"' if self.body else None
        status = 304 if self.body and (headers or {}).get("If-None-Match") == etag else self.status
        r = requests.Response()
        r.status_code = status
        if etag:
            r.headers["ETag"] = etag
        if status == 200:
            import json
            r._content = json.dumps(self.body).encode()
        return r


@pytest.fixture
def faux(monkeypatch, settings, profils_referentiel):
    from django.core.cache import cache
    cache.clear()
    settings.PLANNING_API_URL, settings.CR_SESSIONS_KEY = URL, CLE
    f = FauxPlanning()
    monkeypatch.setattr(planning.requests, "get", f)
    return f


# ── Requete conforme ─────────────────────────────────────────────────────

def test_la_requete_respecte_le_contrat(faux, db):
    faux.body = corps(session_planning())
    planning.synchroniser()
    appel = faux.appels[0]
    assert appel["url"] == URL + planning.PATH
    assert kit.request_errors(SPEC, planning.PATH, appel["params"], appel["headers"]) == []
    assert appel["timeout"]  # jamais d'attente sans borne


# ── Copie ────────────────────────────────────────────────────────────────

def test_copie_une_session_du_planning(faux, db):
    faux.body = corps(session_planning())
    assert planning.synchroniser() == {"creees": 1, "mises_a_jour": 0, "inchangees": 0, "ignorees": 0}
    s = Session.objects.get()
    assert (s.source, str(s.planning_id), s.numero) == ("planning", "7d0c5b1e-2f4a-4c1b-9a43-1f6c2b7e9d10", "PLN-201")
    assert (s.debut.isoformat(), s.fin.isoformat(), s.lieu, s.pays) == ("2026-11-02", "2026-11-06", "Douala", "Cameroun")
    assert (s.formation.code, s.formation.libelle, s.formation.marque) == ("PLN-201", "Climatisation fictive", "Toyota")
    # Mode local : le formateur est reconnu au nom (profil f-a), comme a l'import du fichier.
    assert sorted((a.nom_fichier, a.formateur_id) for a in s.animations.all()) == \
        [("Jean INCONNU", ""), ("Marie FICTIVE", "f-a")]


def test_mode_integre_rattache_par_le_compte(faux, db, settings):
    settings.DEPLOYMENT_MODE = "integrated"
    faux.body = corps(session_planning())
    planning.synchroniser()
    assert Animation.objects.get(nom_fichier="Marie FICTIVE").formateur_id == "sub-marie"


def test_304_et_revision_inchangee_ne_reecrivent_rien(faux, db):
    faux.body = corps(session_planning())
    planning.synchroniser()
    assert planning.synchroniser() is None  # ETag garde : 304
    assert faux.appels[1]["headers"]["If-None-Match"] == '"liste-r1"'
    autre = session_planning(id="0b9f3a52-1c6e-4d2b-8f17-3e5a9c4d2b11", code="PLN-202", revision="r2")
    faux.body = corps(session_planning(), autre)
    assert planning.synchroniser() == {"creees": 1, "mises_a_jour": 0, "inchangees": 1, "ignorees": 0}


def test_le_planning_fait_foi(faux, db):
    faux.body = corps(session_planning())
    planning.synchroniser()
    s = Session.objects.get()
    Animation.objects.filter(session=s, nom_fichier="Jean INCONNU").update(formateur_id="rattache-main")
    faux.body = corps(session_planning(location="Yaounde", end_date="2026-11-07", revision="r2",
                                       trainers=[{"id": "5a1e9c2d-0b7f-4e3a-9d21-6c8f4b2a7e02", "name": "Jean INCONNU", "kind": "TRAINER",
                                                  "is_external": True, "sub": None}]))
    assert planning.synchroniser()["mises_a_jour"] == 1
    s.refresh_from_db()
    assert (s.lieu, s.fin.isoformat()) == ("Yaounde", "2026-11-07")
    # Animateur retire du planning : retire ; rattachement manuel garde.
    assert [(a.nom_fichier, a.formateur_id) for a in s.animations.all()] == [("Jean INCONNU", "rattache-main")]


def test_catalogue_complete_jamais_reecrit(faux, db):
    Formation.objects.create(code="PLN-201", libelle="Libelle du referentiel", marque="")
    faux.body = corps(session_planning())
    planning.synchroniser()
    f = Formation.objects.get()
    assert (f.libelle, f.marque) == ("Libelle du referentiel", "Toyota")


def test_numero_deja_pris_a_la_meme_date(faux, db):
    Session.objects.create(numero="PLN-201", debut="2026-11-02", fin="2026-11-06")  # venue du fichier
    faux.body = corps(session_planning())
    planning.synchroniser()
    assert Session.objects.get(source="planning").numero == "PLN-201-CM"


def test_session_hors_contrat_ignoree(faux, db):
    faux.body = corps(session_planning())
    faux.body["sessions"].append({"id": "pas-un-uuid", "start_date": "2026-11-02"})
    assert planning.synchroniser()["ignorees"] == 1
    assert Session.objects.count() == 1


# ── Planning indisponible ────────────────────────────────────────────────

@pytest.mark.parametrize("panne", ["coupure", 403, 500])
def test_planning_indisponible_la_liste_sert_la_copie(faux, client, pdp_fidele, panne):
    faux.body = corps(session_planning())
    planning.synchroniser()
    from django.core.cache import cache
    cache.clear()
    if panne == "coupure":
        faux.erreur = requests.ConnectionError("arret")
    else:
        faux.body, faux.status = None, panne
    r = client("f-a").get("/cr-donnees/sessions")
    assert r.status_code == 200
    assert [(s["codeSession"], s["source"]) for s in r.json()["sessions"]] == [("PLN-201", "planning")]


def test_liste_lit_le_planning_au_plus_une_fois_par_intervalle(faux, client, pdp_fidele):
    faux.body = corps(session_planning())
    client("f-a").get("/cr-donnees/sessions")
    client("f-a").get("/cr-donnees/sessions")
    assert len(faux.appels) == 1


def test_sans_configuration_aucun_appel(faux, client, pdp_fidele, settings):
    settings.CR_SESSIONS_KEY = ""
    assert client("f-a").get("/cr-donnees/sessions").status_code == 200
    assert faux.appels == []


# ── Import du fichier sur une session du planning ────────────────────────

def test_le_fichier_n_ajoute_que_des_stagiaires(faux, db, excel):
    from datetime import datetime

    from comptes_rendus import import_referentiel
    from conftest import LIGNE
    faux.body = corps(session_planning())
    planning.synchroniser()
    ligne = {**LIGNE, "numero": "PLN-201", "reference": "AUTRE-1", "marque": "Suzuki", "designation": "Autre",
             "animateurs": "Paul AUTRE", "debut": datetime(2026, 11, 2), "fin": datetime(2026, 11, 3),
             "lieu": "Abidjan, Côte d'Ivoire", "nom": "Kone", "prenom": "Awa", "pays": "Cameroun"}
    rapport = import_referentiel.appliquer(import_referentiel.lire(__import__("io").BytesIO(excel([ligne]))),
                                           auteur="test", nom_fichier="fictif.xlsx")
    s = Session.objects.get(source="planning")
    assert (s.lieu, s.fin.isoformat(), s.formation.code) == ("Douala", "2026-11-06", "PLN-201")
    assert sorted(a.nom_fichier for a in s.animations.all()) == ["Jean INCONNU", "Marie FICTIVE"]
    assert [i.stagiaire.nom for i in s.inscriptions.all()] == ["KONE"]
    assert any(a["type"] == "session_du_planning" for a in rapport["anomalies"])
