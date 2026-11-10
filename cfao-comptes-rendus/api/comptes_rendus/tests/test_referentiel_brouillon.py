"""Brouillon lie a une session du referentiel : le serveur reimpose ce qui vient du referentiel."""
import pytest

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


def test_une_session_inconnue_du_referentiel_n_est_pas_liee(client, pdp_fidele, referentiel):
    r = client("f-a").put(url("b10"), corps(referentiel["S-2601"], sessionId="99999"), format="json")
    assert r.status_code == 200 and r.json()["brouillon"]["codeFormation"] == "FAUX-999"


@pytest.mark.parametrize("session_id", ["manuel-1700000000", "s-001", "", "12ab", "-3"])
def test_un_brouillon_manuel_ou_non_numerique_reste_inchange(client, pdp_fidele, referentiel, session_id):
    pdp_fidele.demandes.clear()
    contenu = corps(referentiel["S-2601"], sessionId=session_id)
    r = client("f-a").put(url("b11"), contenu, format="json")
    assert r.status_code == 200
    b = r.json()["brouillon"]
    assert (b["codeFormation"], b["intitule"], b["lieu"], b["debut"]) == ("FAUX-999", "Trafique", "Ailleurs", "2020-01-01")
    assert not [d for d in pdp_fidele.demandes if d["kind"] == "session_formation"]


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
