import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from audit.models import AuditEvent
from core.auth.principal import Principal
from suggestions.models import PortalSuggestion

LIST_URL = "/api/v1/core/portal-suggestions/"

# Faux PDP aligné sur cerbos/policies/resource_policies/portal_suggestion.yaml
# (la politique elle-même est testée par cerbos compile --tests).
CREER = {"center_director", "superadmin"}
LIRE = {"superadmin"}


def _faux_check(principal, kind, rid, attr, action):
    roles = set(principal.get("roles", []))
    return bool(roles & (CREER if action in {"create", "list_own"} else LIRE if action in {"list", "view", "update"} else set()))


def _faux_plan(principal, kind, action, *a, **k):
    roles = set(principal.get("roles", []))
    return {"kind": "KIND_ALWAYS_ALLOWED" if roles & LIRE else "KIND_ALWAYS_DENIED"}


@pytest.fixture(autouse=True)
def pdp(monkeypatch):
    cache.clear()
    monkeypatch.setattr("core.authz.permissions.cerbos.check", _faux_check)
    monkeypatch.setattr("core.authz.viewsets.cerbos.plan", _faux_plan)


def _client(role, pid="u_1"):
    c = APIClient()
    c.force_authenticate(user=Principal(id=pid, roles=[role], username=f"{role}.test"))
    return c


CORPS = {"role_vu": "training_coordinator", "chemin": "/portail", "section": "À traiter",
         "message": "Mettre les sessions de la semaine en premier.", "langue": "fr"}


@pytest.mark.django_db
def test_anonyme_refuse():
    assert APIClient().post(LIST_URL, CORPS, format="json").status_code in (401, 403)


@pytest.mark.django_db
def test_directeur_propose_auteur_tire_du_jeton():
    corps = {**CORPS, "auteur_sub": "usurpe", "auteur_nom": "Autre", "statut": "en_ligne"}
    resp = _client("center_director", "d_1").post(LIST_URL, corps, format="json")
    assert resp.status_code == 201, resp.content
    obj = PortalSuggestion.objects.get()
    assert (obj.auteur_sub, obj.auteur_nom, obj.auteur_roles) == ("d_1", "center_director.test", ["center_director"])
    assert obj.statut == "nouvelle"
    assert AuditEvent.objects.filter(action="portal_suggestion.create", resource_id=str(obj.pk)).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["trainer", "training_coordinator", "learner"])
def test_autres_profils_refuses(role):
    assert _client(role).post(LIST_URL, CORPS, format="json").status_code == 403
    assert not PortalSuggestion.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("champ,valeur", [
    ("role_vu", "superadmin"), ("chemin", "/portail?x=1"), ("chemin", "/<script>"),
    ("message", "court"), ("message", "x" * 2001), ("langue", "de"),
])
def test_corps_invalide(champ, valeur):
    resp = _client("center_director").post(LIST_URL, {**CORPS, champ: valeur}, format="json")
    assert resp.status_code == 400
    assert champ in resp.json()["error"]["details"]


@pytest.mark.django_db
def test_liste_superadmin_seul():
    _client("center_director", "d_1").post(LIST_URL, CORPS, format="json")
    # Directeur : query plan « tout refusé » ⇒ liste vide (fail-closed).
    vu_directeur = _client("center_director").get(LIST_URL)
    assert vu_directeur.status_code == 200
    assert vu_directeur.json().get("results", vu_directeur.json()) == []
    resp = _client("superadmin").get(LIST_URL)
    assert resp.status_code == 200
    lignes = resp.json().get("results", resp.json())
    assert len(lignes) == 1 and lignes[0]["message"] == CORPS["message"]
    assert "auteur_sub" not in lignes[0]


MIENNES_URL = f"{LIST_URL}miennes/"


@pytest.mark.django_db
@pytest.mark.parametrize("saisi,garde", [
    ("ajout_kpi", "ajout_kpi"), ("  Changer   le  pied de page ", "Changer le pied de page"), ("", ""),
])
def test_type_code_ou_texte_libre(saisi, garde):
    resp = _client("center_director").post(LIST_URL, {**CORPS, "type": saisi}, format="json")
    assert resp.status_code == 201, resp.content
    assert PortalSuggestion.objects.get().type == garde == resp.json()["type"]


@pytest.mark.django_db
@pytest.mark.parametrize("valeur", ["x" * 61, "ajout\nkpi", "a\x00b"])
def test_type_invalide(valeur):
    resp = _client("center_director").post(LIST_URL, {**CORPS, "type": valeur}, format="json")
    assert resp.status_code == 400
    assert "type" in resp.json()["error"]["details"]


@pytest.mark.django_db
def test_miennes_seulement_les_siennes_avec_suivi():
    _client("center_director", "d_1").post(LIST_URL, {**CORPS, "type": "ajout_kpi"}, format="json")
    _client("center_director", "d_2").post(LIST_URL, {**CORPS, "message": "Proposition d'un autre compte."}, format="json")
    PortalSuggestion.objects.filter(auteur_sub="d_1").update(statut="lue")
    resp = _client("center_director", "d_1").get(MIENNES_URL)
    assert resp.status_code == 200
    lignes = resp.json()
    assert [(l["message"], l["type"], l["statut"]) for l in lignes] == [(CORPS["message"], "ajout_kpi", "lue")]
    assert "auteur_sub" not in lignes[0]


@pytest.mark.django_db
@pytest.mark.parametrize("role", ["trainer", "training_coordinator", "learner"])
def test_miennes_refusees_aux_autres_profils(role):
    assert _client(role).get(MIENNES_URL).status_code == 403


@pytest.mark.django_db
def test_miennes_limitees_aux_plus_recentes():
    client = _client("superadmin", "s_1")
    for i in range(22):
        PortalSuggestion.objects.create(role_vu="trainer", chemin="/portail", message=f"Proposition numero {i}", auteur_sub="s_1")
    assert len(client.get(MIENNES_URL).json()) == 20


@pytest.mark.django_db
def test_suivi_superadmin_seul_sans_suppression():
    _client("center_director", "d_1").post(LIST_URL, CORPS, format="json")
    url = f"{LIST_URL}{PortalSuggestion.objects.get().pk}/"
    assert _client("center_director").patch(url, {"statut": "lue"}, format="json").status_code == 403
    resp = _client("superadmin", "s_1").patch(url, {"statut": "lue", "message": "changé ailleurs"}, format="json")
    assert resp.status_code == 200
    obj = PortalSuggestion.objects.get()
    assert (obj.statut, obj.suivie_par, obj.message) == ("lue", "s_1", CORPS["message"])
    assert obj.lue_le is not None and obj.etape_le == obj.lue_le
    assert _client("superadmin").delete(url).status_code == 405


def _proposition():
    return PortalSuggestion.objects.create(role_vu="trainer", chemin="/portail", message="Proposition de test", auteur_sub="d_1")


def _suivre(obj, corps):
    return _client("superadmin", "s_1").patch(f"{LIST_URL}{obj.pk}/", corps, format="json")


@pytest.mark.django_db
def test_planifiee_exige_une_date_prevue():
    obj = _proposition()
    assert _suivre(obj, {"statut": "planifiee"}).status_code == 400
    resp = _suivre(obj, {"statut": "planifiee", "echeance": "2026-12-15", "reponse_equipe": "Avec la prochaine version."})
    assert resp.status_code == 200
    obj.refresh_from_db()
    # Étape sautée (Lue) datée d'office ; l'auteur voit la date et le mot.
    assert obj.lue_le and obj.planifiee_le and not obj.en_ligne_le
    assert (str(obj.echeance), obj.reponse_equipe) == ("2026-12-15", "Avec la prochaine version.")
    ligne = _client("center_director", "d_1").get(MIENNES_URL).json()[0]
    assert (ligne["statut"], ligne["echeance"], ligne["reponse_equipe"]) == ("planifiee", "2026-12-15", "Avec la prochaine version.")


@pytest.mark.django_db
def test_non_retenue_exige_un_motif():
    obj = _proposition()
    assert _suivre(obj, {"statut": "non_retenue"}).status_code == 400
    assert _suivre(obj, {"statut": "non_retenue", "reponse_equipe": "Déjà prévu ailleurs."}).status_code == 200
    obj.refresh_from_db()
    assert obj.non_retenue_le and obj.lue_le


@pytest.mark.django_db
def test_retour_en_arriere_efface_les_etapes_suivantes():
    obj = _proposition()
    _suivre(obj, {"statut": "en_ligne"})
    obj.refresh_from_db()
    lue_le = obj.lue_le
    assert obj.en_ligne_le and obj.planifiee_le
    assert _suivre(obj, {"statut": "lue", "echeance": "2026-12-15"}).status_code == 200
    obj.refresh_from_db()
    assert (obj.lue_le, obj.planifiee_le, obj.en_ligne_le, obj.echeance) == (lue_le, None, None, None)


@pytest.mark.django_db
def test_nouvelle_date_prevue_compte_comme_changement():
    obj = _proposition()
    _suivre(obj, {"statut": "planifiee", "echeance": "2026-12-15"})
    obj.refresh_from_db()
    avant = obj.etape_le
    assert _suivre(obj, {"echeance": "2027-01-10"}).status_code == 200
    obj.refresh_from_db()
    assert obj.etape_le > avant and obj.statut == "planifiee"


@pytest.mark.django_db
def test_reponse_equipe_controlee():
    obj = _proposition()
    assert _suivre(obj, {"reponse_equipe": "x" * 501}).status_code == 400
    assert _suivre(obj, {"reponse_equipe": "bip\x07"}).status_code == 400
    assert _suivre(obj, {"reponse_equipe": "ligne 1\nligne 2"}).status_code == 200


@pytest.mark.django_db
def test_limite_20_par_heure():
    client = _client("center_director", "d_flood")
    codes = [client.post(LIST_URL, CORPS, format="json").status_code for _ in range(21)]
    assert codes[:20] == [201] * 20 and codes[20] == 429
