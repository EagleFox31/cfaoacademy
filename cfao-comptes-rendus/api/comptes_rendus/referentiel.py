"""Referentiel des formations : sessions, stagiaires, import du fichier Excel.

Ce module ne decide d'aucun droit : chaque route demande au PDP Cerbos
(`session_formation` pour les sessions, `referentiel` pour l'import), session
par session pour les lectures. Le portail ne voit que ce que le PDP autorise.
"""
import io
from datetime import date, timedelta

from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authz import cerbos

from . import import_referentiel, planning
from .models import Brouillon, Formation, Inscription
from .models import Session as SessionFormation

SESSION = "session_formation"
REFERENTIEL = "referentiel"

TAILLE_MAX = 10 * 1024 * 1024
PARTIES = 5
JOURS_MAX = import_referentiel.JOURS_MAX


class StagiaireHorsSession(ValueError):
    """Le brouillon cite un stagiaire qui n'est pas inscrit a la session."""


# ── Autorisation ───────────────────────────────────────────────────────

def _permis_lot(request, kind, elements, action):
    """{id: autorise} pour des `(id, attributs)` : une requete par lot au PDP."""
    # Via le module : le PDP reste substituable dans les tests.
    return cerbos.check_resources(
        request.user.to_cerbos(),
        [{"kind": kind, "id": ident, "attr": attr} for ident, attr in elements], action)


def _permis(request, kind, ident, action, **attr):
    return _permis_lot(request, kind, [(ident, attr)], action).get(str(ident or "_new"), False)


def _exiger(request, kind, ident, action, **attr):
    if not _permis(request, kind, ident, action, **attr):
        raise PermissionDenied(f"Action '{action}' non autorisee sur cette ressource.")


def formateurs_ids(session):
    return [a.formateur_id for a in session.animations.all() if a.formateur_id]


def peut_lire(request, session):
    return _permis(request, SESSION, str(session.pk), "read", formateurs=formateurs_ids(session))


def _erreur(message, code):
    return Response({"erreur": message}, status=code)


# ── Avancement du compte rendu (fonctions pures) ───────────────────────

def _rempli(valeur):
    return bool(str(valeur if valeur is not None else "").strip())


def _presents(contenu):
    participants = contenu.get("participants")
    return [p for p in participants if isinstance(p, dict) and p.get("present") is not False] \
        if isinstance(participants, list) else []


def _textes(contenu):
    textes = contenu.get("textes")
    return textes if isinstance(textes, dict) else {}


def _notes_saisies(contenu):
    presents = _presents(contenu)
    if not presents:
        return False
    if contenu.get("type") == "certification":
        return all(any(_rempli(v) for v in (p.get("notesModules") or {}).values()) for p in presents)
    return all(_rempli(p.get("entreeBrut")) and _rempli(p.get("sortieTheoBrut"))
               and _rempli(p.get("sortiePratBrut")) for p in presents)


def _objectifs_saisis(contenu):
    return _rempli(_textes(contenu).get("objectifs.objectifs"))


def _journees_saisies(contenu, jours=None):
    textes = _textes(contenu)
    if not jours:
        nb = contenu.get("nbJours")
        jours = nb if isinstance(nb, int) and nb > 0 else None
    if jours:
        return all(any(_rempli(v) for k, v in textes.items() if k.startswith(f"jour-{i}."))
                   for i in range(1, jours + 1))
    return any(_rempli(v) for k, v in textes.items() if k.startswith("jour-"))


def _satisfaction_saisie(contenu):
    presents = _presents(contenu)
    reponses = contenu.get("satisfaction")
    if not presents or not isinstance(reponses, dict):
        return False
    return all(isinstance(reponses.get(str(p.get("id"))), dict)
               and any(_rempli(v) for v in reponses[str(p.get("id"))].values())
               for p in presents)


def _bilan_saisi(contenu):
    return any(_rempli(v) for k, v in _textes(contenu).items()
               if k.startswith("bilan.") and k != "bilan.forme")


def jours_retenus(session):
    """Duree de la session pour le compte rendu : ses jours ouvres (week-ends
    exclus, comme l'ecran), un au moins, bornes a `JOURS_MAX`.

    Une session importee trop longue (anomalie `session_trop_longue`) est
    gardee telle quelle ; son compte rendu, lui, n'a jamais plus de `JOURS_MAX` journees."""
    ouvres = sum(1 for k in range(session.jours)
                 if (session.debut + timedelta(days=k)).weekday() < 5)
    return min(max(1, ouvres), JOURS_MAX)


def completion(contenu, jours=None):
    """Part des cinq parties remplies (notes, objectifs, journees, satisfaction, bilan), en %."""
    if not isinstance(contenu, dict):
        return 0
    faites = sum([_notes_saisies(contenu), _objectifs_saisis(contenu),
                  _journees_saisies(contenu, jours), _satisfaction_saisie(contenu),
                  _bilan_saisi(contenu)])
    return round(100 * faites / PARTIES)


def statut(avancement, valide, fin, aujourdhui=None):
    """a_venir, a_rediger, en_cours ou termine, d'apres le brouillon le plus avance."""
    aujourdhui = aujourdhui or date.today()
    if avancement >= 100 and valide:
        return "termine"
    if avancement > 0:
        return "en_cours"
    return "a_rediger" if fin < aujourdhui else "a_venir"


def _avancement_des_sessions(sessions):
    """{pk: (completion, valide)} d'apres les brouillons de tous les proprietaires."""
    idents = {str(s.pk): s for s in sessions}
    meilleur = {}
    if idents:
        for b in Brouillon.objects.filter(contenu__sessionId__in=list(idents)):
            contenu = b.contenu if isinstance(b.contenu, dict) else {}
            cle = str(contenu.get("sessionId"))
            if cle not in idents:
                continue
            c = completion(contenu, jours_retenus(idents[cle]))
            valide = bool(contenu.get("termineLe"))
            if cle not in meilleur or (c, valide) > meilleur[cle]:
                meilleur[cle] = (c, valide)
    return meilleur


# ── Forme JSON d'une session ───────────────────────────────────────────

def _participants(session):
    inscriptions = sorted(session.inscriptions.all(),
                          key=lambda i: (i.stagiaire.nom, i.stagiaire.prenom, i.pk))
    return [{"id": str(i.pk), "nom": i.stagiaire.nom, "prenom": i.stagiaire.prenom,
             "pays": i.stagiaire.pays, "absent": i.absent, "present": not i.absent}
            for i in inscriptions]


def session_json(session, avancement=None, aujourdhui=None):
    formation = session.formation
    c, valide = avancement or (0, False)
    animations = list(session.animations.all())
    return {
        "id": str(session.pk),
        "codeSession": session.numero,
        "codeFormation": formation.code if formation else "",
        "moduleFormation": (formation.libelle if formation and formation.libelle else session.libelle_fichier),
        "marque": formation.marque if formation else "",
        "paysHote": session.pays,
        "lieu": session.lieu,
        "debut": session.debut.isoformat(),
        "fin": session.fin.isoformat(),
        "nbJours": jours_retenus(session),
        "formateur": ", ".join(a.nom_fichier for a in animations),
        "formateurs": [{"nom": a.nom_fichier, "id": a.formateur_id} for a in animations],
        "seuil": formation.seuil if formation else 70,
        "statut": statut(c, valide, session.fin, aujourdhui),
        "completion": c,
        "participants": _participants(session),
        # « planning » : formation, dates, lieu et animateurs viennent du planning.
        "source": session.source,
    }


def _sessions():
    return SessionFormation.objects.select_related("formation") \
        .prefetch_related("animations", "inscriptions__stagiaire")


# ── Routes ─────────────────────────────────────────────────────────────

def _correspond(session, q, pays, formateur):
    n = import_referentiel.normaliser
    f = session.formation
    if q:
        texte = n(" ".join([session.numero, session.lieu, session.libelle_fichier,
                            f.code if f else "", f.libelle if f else "",
                            " ".join(a.nom_fichier for a in session.animations.all())]))
        if n(q) not in texte:
            return False
    if pays and n(session.pays) != n(import_referentiel.pays_normalise(pays)[0]):
        return False
    if formateur:
        cible = n(formateur)
        if not any(a.formateur_id == formateur or cible in n(a.nom_fichier) for a in session.animations.all()):
            return False
    return True


def _mois_valide(mois):
    return len(mois) == 7 and mois[4] == "-" and mois[:4].isdigit() and mois[5:].isdigit() \
        and 1 <= int(mois[5:]) <= 12 and 1 <= int(mois[:4]) <= 9998


class SessionsListe(APIView):
    def get(self, request):
        _exiger(request, SESSION, "*", "list")
        planning.rafraichir_si_du()  # copie du planning ; servie telle quelle s'il ne repond pas
        p = request.query_params
        mois = p.get("mois", "").strip()
        if mois and not _mois_valide(mois):
            return _erreur("mois invalide (AAAA-MM attendu)", 400)
        marque = p.get("marque", "").strip()
        sessions = _sessions()
        if marque:
            # Sans accents ni casse (Citroen = Citroën), en SQL sur les marques connues.
            n = import_referentiel.normaliser
            connues = Formation.objects.values_list("marque", flat=True).distinct()
            sessions = sessions.filter(formation__marque__in=[m for m in connues if n(m) == n(marque)])
        if mois:
            premier = date(int(mois[:4]), int(mois[5:7]), 1)
            suivant = date(premier.year + (premier.month == 12), premier.month % 12 + 1, 1)
            sessions = sessions.filter(debut__lt=suivant, fin__gte=premier)
        filtres = (p.get("q", "").strip(), p.get("pays", "").strip(), p.get("formateur", "").strip())
        # Le filtre reduit d'abord la liste ; le PDP tranche ensuite, toutes les
        # sessions retenues dans une seule demande (par lots).
        candidates = [s for s in sessions if _correspond(s, *filtres)]
        lisibles = _permis_lot(request, SESSION,
                               [(str(s.pk), {"formateurs": formateurs_ids(s)}) for s in candidates], "read")
        visibles = [s for s in candidates if lisibles.get(str(s.pk))]
        avancement = _avancement_des_sessions(visibles)
        return Response({"sessions": [session_json(s, avancement.get(str(s.pk))) for s in visibles]})


def _session_visible(request, pk):
    """(session, None) si lisible ; (None, reponse d'erreur) sinon."""
    if not str(pk).isdigit():
        return None, _erreur("introuvable", 404)
    session = _sessions().filter(pk=int(pk)).first()
    if not session:
        return None, _erreur("introuvable", 404)
    if not peut_lire(request, session):
        raise PermissionDenied("Action 'read' non autorisee sur cette ressource.")
    return session, None


class SessionDetail(APIView):
    def get(self, request, pk):
        session, erreur = _session_visible(request, pk)
        if erreur:
            return erreur
        return Response(session_json(session, _avancement_des_sessions([session]).get(str(session.pk))))


class InscriptionAbsence(APIView):
    def patch(self, request, pk, insc_id):
        if not str(pk).isdigit() or not str(insc_id).isdigit():
            return _erreur("introuvable", 404)
        session = _sessions().filter(pk=int(pk)).first()
        if not session:
            return _erreur("introuvable", 404)
        _exiger(request, SESSION, str(session.pk), "marquer_absent", formateurs=formateurs_ids(session))
        absent = request.data.get("absent") if isinstance(request.data, dict) else None
        if not isinstance(absent, bool):
            return _erreur("« absent » doit etre vrai ou faux", 400)
        inscription = Inscription.objects.filter(session=session, pk=int(insc_id)) \
            .select_related("stagiaire").first()
        if not inscription:
            return _erreur("introuvable", 404)
        inscription.absent = absent
        inscription.save(update_fields=["absent"])
        s = inscription.stagiaire
        return Response({"id": str(inscription.pk), "nom": s.nom, "prenom": s.prenom, "pays": s.pays,
                         "absent": absent, "present": not absent})


class ReferentielEtat(APIView):
    def get(self, request):
        _exiger(request, SESSION, "*", "list")
        return Response({"vide": not SessionFormation.objects.exists()})


class ReferentielImport(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        _exiger(request, REFERENTIEL, "*", "importer")
        fichier = request.FILES.get("fichier")
        if fichier is None:
            return _erreur("fichier manquant", 400)
        if fichier.size > TAILLE_MAX:
            return _erreur("fichier trop volumineux (10 Mo au plus)", 413)
        try:
            lignes = import_referentiel.lire(io.BytesIO(fichier.read()))
        except import_referentiel.FichierInvalide as e:
            return _erreur(str(e), 400)
        nom = str(fichier.name or "")[:255]
        if request.data.get("appliquer") == "1":
            rapport = import_referentiel.appliquer(lignes, auteur=request.user.id, nom_fichier=nom)
        else:
            rapport = import_referentiel.analyser(lignes, nom_fichier=nom)
        return Response(rapport)


# ── Brouillon lie a une session du referentiel ─────────────────────────

def session_liee(contenu):
    """La session du referentiel dont le brouillon porte l'identifiant, sinon None.

    Les saisies manuelles (`manuel-...`) et les sessions d'essai ne sont pas liees."""
    ident = str(contenu.get("sessionId") or "") if isinstance(contenu, dict) else ""
    if not (ident.isascii() and ident.isdigit()):
        return None
    return _sessions().filter(pk=int(ident)).first()


def referentiel_impose(existant):
    """Vrai si le brouillon doit se rattacher a une session du referentiel.

    Referentiel vide : saisie libre. Sinon, un brouillon nouveau ou deja lie
    doit rester lie ; un ancien brouillon non lie (cree avant le referentiel) reste libre."""
    if not SessionFormation.objects.exists():
        return False
    return existant is None or session_liee(existant.contenu) is not None


def reimposer(contenu, session):
    """Le contenu du brouillon, avec les donnees du referentiel reimposees.

    Le serveur fait foi pour la formation, les dates, le lieu, le nombre de
    journees (celui de la session, `JOURS_MAX` au plus) et l'identite des
    stagiaires ; notes, appreciations, presence et textes restent ceux du formateur.
    Le seuil et le type de compte rendu ne sont pas reimposes : le referentiel
    ne fait que les preremplir, le formateur peut les changer.
    Leve `StagiaireHorsSession` si un participant n'est pas inscrit.
    """
    norm = import_referentiel.normaliser
    formation = session.formation
    sortie = dict(contenu)
    sortie.update({
        "codeFormation": formation.code if formation else "",
        "intitule": (formation.libelle if formation and formation.libelle else session.libelle_fichier),
        "marque": formation.marque if formation else "",
        "debut": session.debut.isoformat(),
        "fin": session.fin.isoformat(),
        "lieu": session.lieu,
        "pays": session.pays,
        "nbJours": jours_retenus(session),
    })
    participants = contenu.get("participants", [])
    if not isinstance(participants, list):
        raise StagiaireHorsSession("participants invalides")

    inscriptions = list(session.inscriptions.all())
    par_id = {str(i.pk): i for i in inscriptions}
    par_nom = {}
    for i in inscriptions:
        par_nom.setdefault((norm(i.stagiaire.nom), norm(i.stagiaire.prenom)), []).append(i)

    vus, resultat = set(), []
    for p in participants:
        if not isinstance(p, dict):
            raise StagiaireHorsSession("stagiaire hors session")
        inscription = par_id.get(str(p.get("id")))
        if inscription is None:
            candidats = par_nom.get((norm(p.get("nom")), norm(p.get("prenom"))), [])
            inscription = candidats[0] if len(candidats) == 1 else None
        if inscription is None:
            raise StagiaireHorsSession("stagiaire hors session")
        if inscription.pk in vus:
            raise StagiaireHorsSession("stagiaire en double")
        vus.add(inscription.pk)
        s = inscription.stagiaire
        resultat.append({**p, "id": p.get("id") if _rempli(p.get("id")) else str(inscription.pk),
                         "nom": s.nom, "prenom": s.prenom, "pays": s.pays})
    for i in inscriptions:
        if i.pk not in vus:
            resultat.append({"id": str(i.pk), "nom": i.stagiaire.nom, "prenom": i.stagiaire.prenom,
                             "pays": i.stagiaire.pays, "present": not i.absent,
                             "entreeBrut": "", "sortieTheoBrut": "", "sortiePratBrut": "",
                             "appreciation": ""})
    sortie["participants"] = resultat
    return sortie
