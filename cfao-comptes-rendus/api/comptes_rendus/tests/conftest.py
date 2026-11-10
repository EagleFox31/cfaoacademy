"""Chaque test travaille dans des dossiers temporaires et sans PDP reel.

Le PDP Cerbos est remplace par la fixture `pdp` : elle autorise par
defaut et note chaque demande (kind, action, attributs), pour verifier
que chaque route passe bien par le PEP. Les regles elles-memes sont
testees par `cerbos compile --tests` (voir `cerbos/tests/`).
"""
import pytest
from rest_framework.test import APIClient

import photos
from comptes_rendus import taches, views
from core.authz import cerbos


@pytest.fixture(autouse=True)
def dossiers_temporaires(tmp_path, monkeypatch):
    """Photos et caches dans `tmp_path`, jamais dans des donnees reelles."""
    monkeypatch.setattr(photos, "PERMANENT", tmp_path / "photos")
    monkeypatch.setattr(views, "CACHE", tmp_path / "cache")


@pytest.fixture(autouse=True)
def taches_synchrones(monkeypatch):
    """La production « en fond » s'execute tout de suite, dans le fil du test."""
    monkeypatch.setattr(taches, "lancer_en_fond", lambda fonction, *args: fonction(*args))


class FauxPDP:
    def __init__(self):
        self.demandes = []
        self.reponse = True
        self.lots = []

    def __call__(self, principal, resource, action):
        self.demandes.append({"principal": principal, "kind": resource["kind"],
                              "id": resource.get("id"), "action": action,
                              "attr": resource.get("attr", {})})
        return self.reponse(principal, resource, action) if callable(self.reponse) else self.reponse

    def lot(self, principal, resources, action):
        """`check_resources` : la meme reponse, ressource par ressource ; chaque appel est note."""
        self.lots.append(len(resources))
        return {str(r.get("id") or "_new"): bool(self(principal, r, action)) for r in resources}


@pytest.fixture(autouse=True)
def pdp(monkeypatch):
    faux = FauxPDP()
    monkeypatch.setattr(cerbos, "check_permission", faux)
    monkeypatch.setattr(cerbos, "check_resources", faux.lot)
    return faux


@pytest.fixture
def client(db):
    """Un client identifie par l'en-tete `X-User-ID` (mode autonome)."""
    def ouvrir(user_id="f-demo"):
        c = APIClient()
        c.credentials(HTTP_X_USER_ID=user_id)
        return c
    return ouvrir


ORIGINE_PORTAIL = "http://localhost:8090"


@pytest.fixture
def anonyme(db):
    """Un navigateur sans session : il envoie l'origine de la passerelle, comme un vrai."""
    return APIClient(HTTP_ORIGIN=ORIGINE_PORTAIL)


# ── Referentiel des formations ─────────────────────────────────────────
# Le PDP fidele reprend les regles de `cerbos/policies/.../compte_rendu.yaml`,
# `session_formation.yaml` et `referentiel.yaml` : les tests de droits du
# referentiel s'appuient dessus plutot que sur l'autorisation par defaut.

FORMATEURS = ("trainer", "ki", "pic")


def regles_cerbos(principal, resource, action):
    roles, kind = set(principal["roles"]), resource["kind"]
    attr = resource.get("attr", {})
    id_ = principal["id"]
    if kind == "session_formation":
        if action == "list":
            return bool(roles & {*FORMATEURS, "lecteur_cr", "admin_referentiel", "superadmin"})
        if action == "read":
            return bool(roles & {"lecteur_cr", "admin_referentiel", "superadmin"}) or \
                (bool(roles & set(FORMATEURS)) and id_ in attr["formateurs"])
        if action == "marquer_absent":
            return "admin_referentiel" in roles or \
                (bool(roles & set(FORMATEURS)) and id_ in attr["formateurs"])
        return False
    if kind == "referentiel":
        return action in ("importer", "modifier") and "admin_referentiel" in roles
    if kind == "compte_rendu":
        if "superadmin" in roles:
            return True
        if action in ("list", "create") and roles & set(FORMATEURS):
            return True
        if action in ("read", "list") and "lecteur_cr" in roles:
            return True
        return action in ("read", "update", "delete") and bool(roles & set(FORMATEURS)) \
            and attr.get("ownerId") == id_
    return True


PROFILS_REFERENTIEL = [
    {"identifiant": "f.a", "id": "f-a", "roles": ["trainer"], "firstName": "Marie", "lastName": "Fictive",
     "scopeNodes": [], "brands": []},
    {"identifiant": "f.b", "id": "f-b", "roles": ["trainer"], "firstName": "Paul", "lastName": "Autre",
     "scopeNodes": [], "brands": []},
    {"identifiant": "f.c", "id": "f-c", "roles": ["trainer"], "firstName": "Sans", "lastName": "Session",
     "scopeNodes": [], "brands": []},
    {"identifiant": "lect", "id": "lect", "roles": ["lecteur_cr"], "firstName": "Lise", "lastName": "Lectrice",
     "scopeNodes": [], "brands": []},
    {"identifiant": "adm", "id": "adm", "roles": ["admin_referentiel"], "firstName": "Admin", "lastName": "DEV1",
     "scopeNodes": [], "brands": []},
    {"identifiant": "tech", "id": "tech", "roles": ["superadmin"], "firstName": "Equipe", "lastName": "Technique",
     "scopeNodes": [], "brands": []},
]


@pytest.fixture
def profils_referentiel(settings, tmp_path):
    """Des profils locaux de test : formateurs f-a (Marie Fictive) et f-b (Paul Autre), lecteur, admin, superadmin."""
    import json
    chemin = tmp_path / "profils-referentiel.json"
    chemin.write_text(json.dumps(PROFILS_REFERENTIEL), encoding="utf-8")
    settings.PROFILS_LOCAUX = str(chemin)
    return PROFILS_REFERENTIEL


@pytest.fixture
def pdp_fidele(pdp, profils_referentiel):
    pdp.reponse = regles_cerbos
    return pdp


LIGNE = {"numero": "", "reference": "", "marque": "", "designation": "", "animateurs": "",
         "debut": None, "fin": None, "lieu": "", "nom": "", "prenom": "", "pays": "", "presence": ""}


def lignes_fictives():
    """Trois sessions inventees : une normale, une sans Reference, une de 7 jours."""
    from datetime import datetime
    a = {"numero": "S-2601", "reference": "ABC-101", "marque": "Toyota", "designation": "Diagnostic moteur fictif",
         "animateurs": "Marie FICTIVE / Jean INCONNU", "debut": datetime(2026, 2, 2), "fin": datetime(2026, 2, 4),
         "lieu": "Douala, Cameroun"}
    b = {"numero": "S-2602", "reference": "", "marque": "Suzuki", "designation": "Freinage fictif",
         "animateurs": "Marie FICTIVE", "debut": "09/03/2026", "fin": "13/03/2026",
         "lieu": "Abidjan, Côte d'Ivoire"}
    c = {"numero": "S-2603", "reference": "ABC-103", "marque": "Toyota", "designation": "Hybride fictif",
         "animateurs": "Paul AUTRE", "debut": datetime(2026, 4, 6), "fin": datetime(2026, 4, 12),
         "lieu": "Libreville, Gabon"}
    return [
        {**a, "nom": "Dupont", "prenom": "alice", "pays": "CAMEROUN", "presence": "Présent"},
        {**a, "nom": "Durand", "prenom": "Bob", "pays": "Cameroun", "presence": "Absent"},
        {**b, "nom": "Kone", "prenom": "Zoé", "pays": "RCI"},
        {**b, "nom": "Zola", "prenom": "Max", "pays": "Atlantide"},
        {**c, "nom": "Martin", "prenom": "Léa", "pays": "Gabon"},
    ]


TITRES = ["N° de la Formation", "Référence", "Marques", "Désignation formation", "Animateurs",
          "Date début formation", "Date fin formation", "Lieu de la formation", "Coût", "Noms",
          "Prénoms", "Pays stagiaires", "Présence à la formation"]
CLE_DE_TITRE = {"N° de la Formation": "numero", "Référence": "reference", "Marques": "marque",
                "Désignation formation": "designation", "Animateurs": "animateurs",
                "Date début formation": "debut", "Date fin formation": "fin",
                "Lieu de la formation": "lieu", "Noms": "nom", "Prénoms": "prenom",
                "Pays stagiaires": "pays", "Présence à la formation": "presence"}


def construire_excel(lignes=None, sans=(), titres=None):
    """Le fichier Excel (octets) : une feuille de garde, puis les titres sous deux lignes de preambule."""
    from io import BytesIO

    from openpyxl import Workbook
    classeur = Workbook()
    garde = classeur.active
    garde.title = "Garde"
    garde["A1"] = "Document fictif"
    feuille = classeur.create_sheet("Participants")
    feuille["A1"] = "Liste des participants (fictive)"
    en_tetes = [t for t in (titres or TITRES) if t not in sans]
    for j, t in enumerate(en_tetes, start=1):
        feuille.cell(row=3, column=j, value=t)
    for i, ligne in enumerate(lignes if lignes is not None else lignes_fictives(), start=4):
        for j, t in enumerate(en_tetes, start=1):
            feuille.cell(row=i, column=j, value=ligne.get(CLE_DE_TITRE.get(t, "")) if t != "Coût" else 1234)
    sortie = BytesIO()
    classeur.save(sortie)
    return sortie.getvalue()


@pytest.fixture
def excel():
    return construire_excel


@pytest.fixture
def referentiel(db, profils_referentiel):
    """Le fichier fictif applique : 3 sessions, 5 stagiaires."""
    from comptes_rendus import import_referentiel
    from comptes_rendus.models import Session
    import_referentiel.appliquer(import_referentiel.lire(__import__("io").BytesIO(construire_excel())),
                                 auteur="test", nom_fichier="fictif.xlsx")
    return {s.numero: s for s in Session.objects.all()}
