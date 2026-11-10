"""Sessions du referentiel : liste filtree par droits, detail, absences, etat, avancement.

Les droits passent par `pdp_fidele`, un PDP qui reprend les regles des policies Cerbos.
"""
from datetime import date, timedelta

import pytest

from comptes_rendus import referentiel as ref
from comptes_rendus import stockage
from comptes_rendus.models import Inscription, Session

LISTE = "/cr-donnees/sessions"


def numeros(reponse):
    return sorted(s["codeSession"] for s in reponse.json()["sessions"])


# ── Liste et droits ────────────────────────────────────────────────────

def test_un_formateur_ne_voit_que_ses_sessions(client, pdp_fidele, referentiel):
    r = client("f-a").get(LISTE)
    assert r.status_code == 200 and numeros(r) == ["S-2601", "S-2602"]
    assert numeros(client("f-b").get(LISTE)) == ["S-2603"]
    assert numeros(client("f-c").get(LISTE)) == []


def test_lecteur_administrateur_et_superadmin_voient_tout(client, pdp_fidele, referentiel):
    for identifiant in ("lect", "adm", "tech"):
        assert numeros(client(identifiant).get(LISTE)) == ["S-2601", "S-2602", "S-2603"]


def test_la_liste_demande_list_puis_read_par_session(client, pdp_fidele, referentiel):
    pdp_fidele.demandes.clear()
    client("f-a").get(LISTE)
    sessions = [d for d in pdp_fidele.demandes if d["kind"] == "session_formation"]
    assert (sessions[0]["action"], sessions[0]["id"]) == ("list", "*")
    lectures = sessions[1:]
    assert len(lectures) == 3 and all(d["action"] == "read" for d in lectures)
    par_numero = {str(s.pk): n for n, s in referentiel.items()}
    animateurs = {par_numero[d["id"]]: d["attr"]["formateurs"] for d in lectures}
    assert animateurs == {"S-2601": ["f-a"], "S-2602": ["f-a"], "S-2603": ["f-b"]}


def test_la_liste_est_refusee_a_un_role_sans_droit(client, pdp_fidele, referentiel):
    pdp_fidele.reponse = lambda principal, resource, action: False
    assert client("f-a").get(LISTE).status_code == 403


def test_une_session_est_decrite_pour_le_portail(client, pdp_fidele, referentiel):
    s = client("adm").get(LISTE).json()["sessions"]
    a = next(x for x in s if x["codeSession"] == "S-2601")
    assert a["id"] == str(referentiel["S-2601"].pk)
    assert (a["codeFormation"], a["moduleFormation"], a["marque"]) == ("ABC-101", "Diagnostic moteur fictif", "Toyota")
    assert (a["paysHote"], a["lieu"], a["debut"], a["fin"]) == ("Cameroun", "Douala, Cameroun", "2026-02-02", "2026-02-04")
    assert a["formateur"] == "Marie FICTIVE, Jean INCONNU"
    assert a["formateurs"] == [{"nom": "Marie FICTIVE", "id": "f-a"}, {"nom": "Jean INCONNU", "id": ""}]
    assert (a["seuil"], a["completion"]) == (70, 0)
    assert [(p["nom"], p["prenom"], p["absent"], p["present"]) for p in a["participants"]] == [
        ("DUPONT", "Alice", False, True), ("DURAND", "Bob", True, False)]
    sans_reference = next(x for x in s if x["codeSession"] == "S-2602")
    assert sans_reference["codeFormation"] == "" and sans_reference["moduleFormation"] == "Freinage fictif"


# ── Filtres ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("parametres,attendu", [
    ({"q": "diagnostic"}, ["S-2601"]),
    ({"q": "DIAGNOSTIC MOTEUR"}, ["S-2601"]),
    ({"q": "s-2602"}, ["S-2602"]),
    ({"q": "libreville"}, ["S-2603"]),
    ({"q": "abc-10"}, ["S-2601", "S-2603"]),
    ({"q": "abidjan"}, ["S-2602"]),
    ({"q": "introuvable"}, []),
    ({"pays": "Cameroun"}, ["S-2601"]),
    ({"pays": "cote d'ivoire"}, ["S-2602"]),
    ({"pays": "RCI"}, ["S-2602"]),
    ({"marque": "toyota"}, ["S-2601", "S-2603"]),
    ({"marque": "Suzuki"}, []),
    ({"mois": "2026-02"}, ["S-2601"]),
    ({"mois": "2026-03"}, ["S-2602"]),
    ({"mois": "2026-04"}, ["S-2603"]),
    ({"mois": "2026-05"}, []),
    ({"formateur": "f-a"}, ["S-2601", "S-2602"]),
    ({"formateur": "paul"}, ["S-2603"]),
    ({"formateur": "jean inconnu"}, ["S-2601"]),
    ({"marque": "toyota", "mois": "2026-04"}, ["S-2603"]),
])
def test_filtres_de_la_liste(client, pdp_fidele, referentiel, parametres, attendu):
    r = client("adm").get(LISTE, parametres)
    assert r.status_code == 200 and numeros(r) == attendu


def test_le_filtre_ne_contourne_pas_les_droits(client, pdp_fidele, referentiel):
    assert numeros(client("f-a").get(LISTE, {"formateur": "paul"})) == []
    assert numeros(client("f-a").get(LISTE, {"marque": "toyota"})) == ["S-2601"]


def test_une_session_a_cheval_sur_deux_mois_est_dans_les_deux(client, pdp_fidele, referentiel):
    Session.objects.filter(numero="S-2601").update(debut=date(2026, 1, 30), fin=date(2026, 2, 3))
    assert numeros(client("adm").get(LISTE, {"mois": "2026-01"})) == ["S-2601"]
    assert numeros(client("adm").get(LISTE, {"mois": "2026-02"})) == ["S-2601"]


@pytest.mark.parametrize("mois", ["2026", "2026-13", "26-01", "abcd-ef", "2026-1"])
def test_un_mois_invalide_est_refuse(client, pdp_fidele, referentiel, mois):
    assert client("adm").get(LISTE, {"mois": mois}).status_code == 400


def test_la_marque_vient_de_la_formation_donc_manque_sans_reference(client, pdp_fidele, referentiel):
    # S-2602 n'a pas de Reference dans le fichier : pas de formation, donc pas de marque.
    s = client("adm").get(f"{LISTE}/{referentiel['S-2602'].pk}").json()
    assert (s["codeFormation"], s["marque"]) == ("", "")


# ── Detail ─────────────────────────────────────────────────────────────

def test_le_detail_d_une_session_suit_le_droit_de_lecture(client, pdp_fidele, referentiel):
    url = f"{LISTE}/{referentiel['S-2601'].pk}"
    assert client("f-a").get(url).json()["codeSession"] == "S-2601"
    assert client("lect").get(url).status_code == 200
    assert client("f-b").get(url).status_code == 403
    assert client("f-c").get(url).status_code == 403


def test_le_detail_d_une_session_inconnue_est_introuvable(client, pdp_fidele, referentiel):
    assert client("adm").get(f"{LISTE}/99999").status_code == 404
    assert client("adm").get(f"{LISTE}/abc").status_code == 404


# ── Absences ───────────────────────────────────────────────────────────

def url_absence(referentiel, numero="S-2601", nom="DUPONT"):
    s = referentiel[numero]
    return f"{LISTE}/{s.pk}/inscriptions/{Inscription.objects.get(session=s, stagiaire__nom=nom).pk}"


def test_un_formateur_marque_un_absent_sur_sa_session(client, pdp_fidele, referentiel):
    r = client("f-a").patch(url_absence(referentiel), {"absent": True}, format="json")
    assert r.status_code == 200 and r.json()["absent"] is True and r.json()["present"] is False
    assert Inscription.objects.get(stagiaire__nom="DUPONT").absent is True
    r = client("f-a").patch(url_absence(referentiel), {"absent": False}, format="json")
    assert r.json()["present"] is True and Inscription.objects.get(stagiaire__nom="DUPONT").absent is False


def test_l_administrateur_marque_un_absent_sur_toute_session(client, pdp_fidele, referentiel):
    r = client("adm").patch(url_absence(referentiel, "S-2603", "MARTIN"), {"absent": True}, format="json")
    assert r.status_code == 200


@pytest.mark.parametrize("identifiant", ["f-b", "f-c", "lect", "tech"])
def test_absence_refusee_hors_de_ses_sessions(client, pdp_fidele, referentiel, identifiant):
    r = client(identifiant).patch(url_absence(referentiel), {"absent": True}, format="json")
    assert r.status_code == 403
    assert Inscription.objects.get(stagiaire__nom="DUPONT").absent is False


@pytest.mark.parametrize("valeur", ["oui", 1, None, "true"])
def test_l_absence_doit_etre_un_booleen(client, pdp_fidele, referentiel, valeur):
    r = client("f-a").patch(url_absence(referentiel), {"absent": valeur}, format="json")
    assert r.status_code == 400 and Inscription.objects.get(stagiaire__nom="DUPONT").absent is False


def test_absence_d_un_stagiaire_d_une_autre_session_ou_inconnu(client, pdp_fidele, referentiel):
    autre = Inscription.objects.get(session=referentiel["S-2603"]).pk
    s = referentiel["S-2601"].pk
    assert client("f-a").patch(f"{LISTE}/{s}/inscriptions/{autre}", {"absent": True}, format="json").status_code == 404
    assert client("f-a").patch(f"{LISTE}/{s}/inscriptions/99999", {"absent": True}, format="json").status_code == 404
    assert client("f-a").patch(f"{LISTE}/99999/inscriptions/1", {"absent": True}, format="json").status_code == 404
    assert client("f-a").patch(f"{LISTE}/{s}/inscriptions/x", {"absent": True}, format="json").status_code == 404


# ── Etat du referentiel ────────────────────────────────────────────────

def test_l_etat_dit_si_le_referentiel_est_vide(client, pdp_fidele):
    assert client("adm").get("/cr-donnees/referentiel/etat").json() == {"vide": True}


def test_l_etat_apres_import(client, pdp_fidele, referentiel):
    assert client("f-a").get("/cr-donnees/referentiel/etat").json() == {"vide": False}


def test_l_etat_est_refuse_sans_droit_de_liste(client, pdp_fidele, referentiel):
    pdp_fidele.reponse = lambda principal, resource, action: False
    assert client("f-a").get("/cr-donnees/referentiel/etat").status_code == 403


# ── Avancement et statut ───────────────────────────────────────────────

def contenu_complet(ident="1", jours=3):
    textes = {"objectifs.objectifs": "ok", "bilan.points": "ok", "bilan.forme": "libre"}
    textes.update({f"jour-{i}.theme": "ok" for i in range(1, jours + 1)})
    return {"type": "formation", "nbJours": jours,
            "participants": [{"id": ident, "present": True, "entreeBrut": "10", "sortieTheoBrut": "12",
                              "sortiePratBrut": "14"}],
            "textes": textes, "satisfaction": {ident: {"q1": "4"}}}


def test_completion_totale_et_par_partie():
    c = contenu_complet()
    assert ref.completion(c) == 100
    sans_satisfaction = {**c, "satisfaction": {}}
    assert ref.completion(sans_satisfaction) == 80
    assert ref.completion({**c, "textes": {k: v for k, v in c["textes"].items() if not k.startswith("bilan.")}}) == 80
    assert ref.completion({**c, "textes": {**c["textes"], "bilan.points": ""}}) == 80
    assert ref.completion({}) == 0 and ref.completion(None) == 0 and ref.completion("x") == 0


def test_le_choix_du_bilan_ne_compte_pas_comme_texte():
    c = {"textes": {"bilan.forme": "libre"}}
    assert ref.completion(c) == 0


def test_toutes_les_journees_doivent_etre_remplies():
    c = contenu_complet(jours=3)
    manque = {**c, "textes": {k: v for k, v in c["textes"].items() if not k.startswith("jour-3.")}}
    assert ref.completion(manque) == 80
    assert ref.completion(manque, jours=2) == 100
    # Sans nombre de jours connu, une seule journee suffit.
    sans_nb = {k: v for k, v in manque.items() if k != "nbJours"}
    assert ref.completion(sans_nb) == 100


def test_un_absent_n_est_pas_attendu_dans_les_notes_ni_la_satisfaction():
    c = contenu_complet()
    c["participants"].append({"id": "2", "present": False})
    assert ref.completion(c) == 100
    c["participants"][1]["present"] = True
    assert ref.completion(c) == 60


def test_une_certification_compte_les_notes_de_modules():
    c = contenu_complet()
    c["type"] = "certification"
    assert ref.completion(c) == 80
    c["participants"][0]["notesModules"] = {"m1": "", "m2": "15"}
    assert ref.completion(c) == 100


def test_le_statut_depend_de_l_avancement_de_la_validation_et_de_la_date():
    hier, demain = date(2026, 5, 9), date(2026, 5, 11)
    jour = date(2026, 5, 10)
    assert ref.statut(0, False, demain, jour) == "a_venir"
    assert ref.statut(0, False, jour, jour) == "a_venir"
    assert ref.statut(0, False, hier, jour) == "a_rediger"
    assert ref.statut(40, False, hier, jour) == "en_cours"
    assert ref.statut(40, False, demain, jour) == "en_cours"
    assert ref.statut(100, False, hier, jour) == "en_cours"
    assert ref.statut(100, True, hier, jour) == "termine"
    assert ref.statut(40, True, hier, jour) == "en_cours"


def lier(owner, session, contenu, suffixe=""):
    stockage.ecrire(owner, f"cr-{owner}-{session.pk}{suffixe}", {**contenu, "sessionId": str(session.pk)})


def test_le_statut_d_une_session_suit_les_brouillons(client, pdp_fidele, referentiel):
    aujourd_hui = date.today()
    futur, passe = referentiel["S-2601"], referentiel["S-2602"]
    Session.objects.filter(pk=futur.pk).update(debut=aujourd_hui + timedelta(days=5), fin=aujourd_hui + timedelta(days=7))
    Session.objects.filter(pk=passe.pk).update(debut=aujourd_hui - timedelta(days=9), fin=aujourd_hui - timedelta(days=5))
    par_numero = lambda: {s["codeSession"]: s for s in client("adm").get(LISTE).json()["sessions"]}
    avant = par_numero()
    assert avant["S-2601"]["statut"] == "a_venir" and avant["S-2602"]["statut"] == "a_rediger"
    lier("f-a", passe, {"textes": {"objectifs.objectifs": "ok"}})
    apres = par_numero()
    assert apres["S-2602"]["statut"] == "en_cours" and apres["S-2602"]["completion"] == 20
    complet = {**contenu_complet(jours=passe.jours), "termineLe": "2026-01-01"}
    complet["participants"] = [{"id": str(i.pk), "present": True, "entreeBrut": "1", "sortieTheoBrut": "1",
                                "sortiePratBrut": "1"} for i in passe.inscriptions.all()]
    complet["satisfaction"] = {str(i.pk): {"q1": "4"} for i in passe.inscriptions.all()}
    lier("f-a", passe, complet, "-bis")
    fini = par_numero()["S-2602"]
    assert (fini["statut"], fini["completion"]) == ("termine", 100)


def test_le_brouillon_le_plus_avance_est_retenu(client, pdp_fidele, referentiel):
    s = referentiel["S-2601"]
    lier("f-a", s, {"textes": {"objectifs.objectifs": "ok"}})
    lier("f-b", s, {"textes": {"objectifs.objectifs": "ok", "bilan.points": "ok"}})
    assert client("adm").get(f"{LISTE}/{s.pk}").json()["completion"] == 40


def test_un_brouillon_manuel_ou_d_une_autre_session_ne_compte_pas(client, pdp_fidele, referentiel):
    s, autre = referentiel["S-2601"], referentiel["S-2603"]
    stockage.ecrire("f-a", "manuel-1", {"sessionId": "manuel-1", "textes": {"objectifs.objectifs": "ok"}})
    lier("f-b", autre, {"textes": {"objectifs.objectifs": "ok"}})
    assert client("adm").get(f"{LISTE}/{s.pk}").json()["completion"] == 0
