"""Brouillon lie a une session du referentiel : le serveur reimpose ce qui vient du referentiel."""
import pytest

from comptes_rendus import stockage
from comptes_rendus.models import Brouillon, Inscription


def url(ident):
    return f"/cr-donnees/brouillons/{ident}"


def corps(session, **extra):
    base = {"sessionId": str(session.pk), "intitule": "Trafique", "codeFormation": "FAUX-999", "marque": "Autre",
            "lieu": "Ailleurs", "pays": "Nulle part", "debut": "2020-01-01", "fin": "2020-01-02",
            "participants": [], "textes": {"objectifs.objectifs": "Objectifs du formateur"}}
    base.update(extra)
    return base


def test_le_serveur_reimpose_formation_dates_et_lieu(client, pdp_fidele, referentiel):
    s = referentiel["S-2601"]
    r = client("f-a").put(url("b1"), corps(s), format="json")
    assert r.status_code == 200
    b = r.json()["brouillon"]
    assert (b["codeFormation"], b["intitule"], b["marque"]) == ("ABC-101", "Diagnostic moteur fictif", "Toyota")
    assert (b["debut"], b["fin"], b["lieu"], b["pays"]) == ("2026-02-02", "2026-02-04", "Douala, Cameroun", "Cameroun")
    assert b["textes"] == {"objectifs.objectifs": "Objectifs du formateur"}
    assert Brouillon.objects.get(ident="b1").contenu["codeFormation"] == "ABC-101"


def test_une_session_sans_reference_vide_le_code_de_formation(client, pdp_fidele, referentiel):
    b = client("f-a").put(url("b2"), corps(referentiel["S-2602"]), format="json").json()["brouillon"]
    assert (b["codeFormation"], b["intitule"]) == ("", "Freinage fictif")


def test_les_inscrits_manquants_sont_ajoutes_et_les_notes_conservees(client, pdp_fidele, referentiel):
    s = referentiel["S-2601"]
    dupont = Inscription.objects.get(session=s, stagiaire__nom="DUPONT")
    participants = [{"id": str(dupont.pk), "nom": "Faux", "prenom": "Nom", "present": True,
                     "entreeBrut": "10", "sortieTheoBrut": "12", "sortiePratBrut": "14", "appreciation": "Bien"}]
    r = client("f-a").put(url("b3"), corps(s, participants=participants), format="json")
    liste = r.json()["brouillon"]["participants"]
    assert len(liste) == 2
    a, d = liste
    assert (a["id"], a["nom"], a["prenom"], a["pays"]) == (str(dupont.pk), "DUPONT", "Alice", "Cameroun")
    assert (a["entreeBrut"], a["sortiePratBrut"], a["appreciation"]) == ("10", "14", "Bien")
    assert (d["nom"], d["present"], d["entreeBrut"]) == ("DURAND", False, "")


def test_un_stagiaire_est_retrouve_par_son_nom_a_defaut_d_identifiant(client, pdp_fidele, referentiel):
    s = referentiel["S-2601"]
    participants = [{"nom": "dupont", "prenom": "ALICE", "present": True, "entreeBrut": "9"}]
    liste = client("f-a").put(url("b4"), corps(s, participants=participants), format="json").json()["brouillon"]["participants"]
    assert liste[0]["nom"] == "DUPONT" and liste[0]["entreeBrut"] == "9" and liste[0]["id"]
    assert len(liste) == 2


def test_un_stagiaire_invente_est_refuse_sans_rien_stocker(client, pdp_fidele, referentiel):
    s = referentiel["S-2601"]
    r = client("f-a").put(url("b5"), corps(s, participants=[{"id": "99999", "nom": "Inconnu", "prenom": "Zed"}]),
                          format="json")
    assert r.status_code == 400
    assert not Brouillon.objects.filter(ident="b5").exists()


def test_un_stagiaire_d_une_autre_session_est_refuse(client, pdp_fidele, referentiel):
    autre = Inscription.objects.get(session=referentiel["S-2603"])
    r = client("f-a").put(url("b6"), corps(referentiel["S-2601"], participants=[{"id": str(autre.pk)}]),
                          format="json")
    assert r.status_code == 400 and not Brouillon.objects.filter(ident="b6").exists()


def test_un_stagiaire_en_double_est_refuse(client, pdp_fidele, referentiel):
    s = referentiel["S-2601"]
    dupont = Inscription.objects.get(session=s, stagiaire__nom="DUPONT")
    r = client("f-a").put(url("b7"), corps(s, participants=[{"id": str(dupont.pk)}, {"id": str(dupont.pk)}]),
                          format="json")
    assert r.status_code == 400


def test_des_participants_mal_formes_sont_refuses(client, pdp_fidele, referentiel):
    s = referentiel["S-2601"]
    assert client("f-a").put(url("b8"), corps(s, participants="x"), format="json").status_code == 400
    assert client("f-a").put(url("b8"), corps(s, participants=["x"]), format="json").status_code == 400


def test_on_n_ecrit_pas_sur_la_session_d_un_autre_formateur(client, pdp_fidele, referentiel):
    r = client("f-b").put(url("b9"), corps(referentiel["S-2601"]), format="json")
    assert r.status_code == 403 and not Brouillon.objects.filter(ident="b9").exists()
    assert client("lect").put(url("b9"), corps(referentiel["S-2601"]), format="json").status_code == 403


def test_une_session_inconnue_du_referentiel_est_refusee_pour_un_brouillon_nouveau(client, pdp_fidele, referentiel):
    r = client("f-a").put(url("b10"), corps(referentiel["S-2601"], sessionId="99999"), format="json")
    assert r.status_code == 400 and "session du referentiel" in r.json()["erreur"]
    assert not Brouillon.objects.filter(ident="b10").exists()


@pytest.mark.parametrize("session_id", ["manuel-1700000000", "s-001", "", "12ab", "-3"])
def test_un_brouillon_manuel_ou_non_numerique_est_refuse_si_le_referentiel_est_charge(
        client, pdp_fidele, referentiel, session_id):
    pdp_fidele.demandes.clear()
    r = client("f-a").put(url("b11"), corps(referentiel["S-2601"], sessionId=session_id), format="json")
    assert r.status_code == 400 and "session du referentiel" in r.json()["erreur"]
    assert not Brouillon.objects.filter(ident="b11").exists()
    assert not [d for d in pdp_fidele.demandes if d["kind"] == "session_formation"]


def test_sans_referentiel_la_saisie_manuelle_reste_libre(client, pdp_fidele):
    contenu = {"sessionId": "manuel-1", "intitule": "Trafique", "codeFormation": "FAUX-999", "marque": "Autre",
               "textes": {}}
    r = client("f-a").put(url("b11"), contenu, format="json")
    assert r.status_code == 200
    assert r.json()["brouillon"]["codeFormation"] == "FAUX-999"


def test_un_ancien_brouillon_non_lie_reste_modifiable(client, pdp_fidele, referentiel):
    stockage.ecrire("f-a", "vieux", {"sessionId": "manuel-1", "intitule": "Ancien", "textes": {}})
    r = client("f-a").put(url("vieux"), {"sessionId": "manuel-1", "intitule": "Retouche", "textes": {},
                                          "revision": 1}, format="json")
    assert r.status_code == 200 and r.json()["brouillon"]["intitule"] == "Retouche"


def test_la_copie_de_l_equipe_technique_d_un_ancien_brouillon_non_lie_reste_libre(client, pdp_fidele, referentiel):
    stockage.ecrire("f-a", "vieux2", {"sessionId": "manuel-1", "intitule": "Ancien", "textes": {}})
    r = client("tech").put(url("vieux2"), {"sessionId": "manuel-1", "intitule": "Repro", "textes": {}},
                           format="json")
    assert r.status_code == 200 and r.json()["brouillon"]["intitule"] == "Repro"
    # Un formateur n'herite pas de la liberte du brouillon d'un autre.
    r = client("f-b").put(url("vieux2"), {"sessionId": "manuel-1", "intitule": "X", "textes": {}}, format="json")
    assert r.status_code == 400


def test_sans_droit_le_refus_precede_la_validation(client, pdp_fidele, referentiel):
    r = client("lect").put(url("b12"), {"sessionId": "manuel-1", "intitule": "X", "textes": {}}, format="json")
    assert r.status_code == 403


def test_un_brouillon_lie_ne_peut_pas_etre_delie(client, pdp_fidele, referentiel):
    s = referentiel["S-2601"]
    premier = client("f-a").put(url("b14"), corps(s), format="json").json()["brouillon"]
    r = client("f-a").put(url("b14"), corps(s, sessionId="manuel-1", revision=premier["revision"]), format="json")
    assert r.status_code == 400
    assert Brouillon.objects.get(ident="b14").contenu["sessionId"] == str(s.pk)


def demandes_cr(pdp, action):
    return [d for d in pdp.demandes if d["kind"] == "compte_rendu" and d["action"] == action]


def test_la_creation_est_jugee_sur_le_perimetre_reimpose(client, pdp_fidele, referentiel):
    # Le client envoie la marque « Autre » ; le referentiel dit « Toyota » : c'est elle qui fait foi.
    pdp_fidele.demandes.clear()
    r = client("f-a").put(url("b15"), corps(referentiel["S-2601"], marque="Autre"), format="json")
    assert r.status_code == 200
    creations = demandes_cr(pdp_fidele, "create")
    assert [d["attr"]["brand"] for d in creations] == ["Toyota"]


def test_un_changement_de_perimetre_demande_update_sur_l_ancien_et_create_sur_le_nouveau(
        client, pdp_fidele, referentiel):
    s = referentiel["S-2601"]
    stockage.ecrire("f-a", "b16", {"sessionId": str(s.pk), "marque": "Ancienne", "scopeNode": "n1", "textes": {}})
    pdp_fidele.demandes.clear()
    r = client("f-a").put(url("b16"), corps(s, revision=1), format="json")
    assert r.status_code == 200
    (maj,) = demandes_cr(pdp_fidele, "update")
    (cree,) = demandes_cr(pdp_fidele, "create")
    assert (maj["attr"]["brand"], maj["attr"]["scopeNode"]) == ("Ancienne", "n1")
    assert (cree["attr"]["brand"], cree["attr"]["scopeNode"]) == ("Toyota", "")


def test_sans_changement_de_perimetre_pas_de_create(client, pdp_fidele, referentiel):
    s = referentiel["S-2601"]
    c = client("f-a")
    premier = c.put(url("b17"), corps(s), format="json").json()["brouillon"]
    pdp_fidele.demandes.clear()
    assert c.put(url("b17"), corps(s, revision=premier["revision"]), format="json").status_code == 200
    assert len(demandes_cr(pdp_fidele, "update")) == 1 and not demandes_cr(pdp_fidele, "create")


def test_le_nombre_de_jours_est_reimpose_et_borne(client, pdp_fidele, referentiel):
    court = client("f-a").put(url("b18"), corps(referentiel["S-2601"], nbJours=9), format="json").json()["brouillon"]
    assert court["nbJours"] == 3
    # S-2603 dure 7 jours : le compte rendu n'en a jamais plus de 5.
    long = client("f-b").put(url("b19"), corps(referentiel["S-2603"], nbJours=1), format="json").json()["brouillon"]
    assert long["nbJours"] == 5


def test_le_nombre_de_jours_compte_les_jours_ouvres_comme_l_ecran():
    from datetime import date
    from comptes_rendus.models import Session
    from comptes_rendus.referentiel import jours_retenus
    # Du jeudi au mardi : 6 jours calendaires, 4 ouvres.
    assert jours_retenus(Session(debut=date(2026, 2, 5), fin=date(2026, 2, 10))) == 4
    # Un samedi seul compte pour une journee.
    assert jours_retenus(Session(debut=date(2026, 2, 7), fin=date(2026, 2, 7))) == 1


def test_la_session_expose_le_nombre_de_jours_retenu(referentiel):
    from comptes_rendus.referentiel import session_json
    assert session_json(referentiel["S-2601"])["nbJours"] == 3
    assert session_json(referentiel["S-2603"])["nbJours"] == 5


def test_le_seuil_et_le_type_ne_sont_pas_reimposes(client, pdp_fidele, referentiel):
    b = client("f-a").put(url("b20"), corps(referentiel["S-2601"], seuil=70, type="seminaire"),
                          format="json").json()["brouillon"]
    assert (b["seuil"], b["type"]) == (70, "seminaire")


def test_un_brouillon_lie_demande_la_lecture_de_la_session(client, pdp_fidele, referentiel):
    s = referentiel["S-2601"]
    pdp_fidele.demandes.clear()
    client("f-a").put(url("b12"), corps(s), format="json")
    lectures = [d for d in pdp_fidele.demandes if d["kind"] == "session_formation"]
    assert len(lectures) == 1
    assert (lectures[0]["action"], lectures[0]["id"], lectures[0]["attr"]["formateurs"]) == ("read", str(s.pk), ["f-a"])


def test_une_nouvelle_ecriture_garde_les_notes_et_la_revision(client, pdp_fidele, referentiel):
    s = referentiel["S-2601"]
    c = client("f-a")
    premier = c.put(url("b13"), corps(s), format="json").json()["brouillon"]
    suite = corps(s, textes={"objectifs.objectifs": "Modifie"}, revision=premier["revision"])
    r = c.put(url("b13"), suite, format="json")
    assert r.status_code == 200 and r.json()["brouillon"]["revision"] == premier["revision"] + 1
    assert r.json()["brouillon"]["textes"] == {"objectifs.objectifs": "Modifie"}
