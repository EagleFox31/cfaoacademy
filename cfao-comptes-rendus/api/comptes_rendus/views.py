"""L'interface HTTP du service des comptes rendus formateur.

Memes routes, memes corps JSON et memes codes que le service precedent
(Flask), pour que le portail n'ait rien a changer :

    GET  /apercu/sante                     le service repond-il, LibreOffice est-il la
    POST /apercu/page                      l'image d'une diapositive
    POST /apercu/photo                     une photo, reduite ; renvoie son identifiant
    POST /apercu/document                  le rapport complet (pptx ou pdf)
    POST /apercu/rapport                   le rapport complet, page par page
    POST /apercu/rapports                  le meme, produit en tache de fond
    GET  /apercu/rapports/<id>[/fichier]   son etat, puis le fichier
    POST /apercu/redaction                 une proposition de texte
    /cr-donnees/connexion|session|deconnexion
    /cr-donnees/brouillons[/<id>]          les comptes rendus en cours
    GET  /cr-donnees/photos/<id>.jpg       une photo envoyee

Chaque route qui touche une donnee appelle le PEP Cerbos
(`enforce_permission`) : aucun role n'est teste dans ce fichier.
"""
from pathlib import Path

from django.conf import settings
from django.http import FileResponse
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

import photos
from core.auth import locale
from core.auth.identity import profil_local
from core.authz.cerbos import enforce_permission
from moteur import rediger
from moteur_certification import rediger_appreciation_certification, rediger_bilan_certification
from moteur_fiche import rediger_appreciation
from moteur_session import rediger_acquisition, rediger_bilan, rediger_progression
from service import CACHE, MODELE, SOFFICE, document, image_de, rapport

from . import stockage, taches
from .models import Brouillon, Photo, TacheRapport
from .perimetre import perimetre_du_contenu

COMPTE_RENDU = "compte_rendu"
PHOTO = "compte_rendu_photo"
RENDU = "compte_rendu_rendu"


def _erreur(message, code):
    return Response({"erreur": message}, status=code)


def _autoriser(request, kind, ident, action, owner=None, scope_node="", brand=""):
    """PEP : la decision revient au PDP Cerbos (default-deny)."""
    enforce_permission(request.user.to_cerbos(), {
        "kind": kind,
        "id": ident,
        "attr": {"ownerId": owner if owner is not None else request.user.id,
                 "scopeNode": scope_node, "brand": brand},
    }, action)


def _corps(request):
    return request.data if isinstance(request.data, dict) else {}


class Sante(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "pret": Path(MODELE).exists() and Path(SOFFICE).exists(),
            "modele": Path(MODELE).name,
            "libreoffice": Path(SOFFICE).exists(),
        })


# ── Connexion ──────────────────────────────────────────────────────────
# Mode integre : l'identite vient de Keycloak (oauth2-proxy), le portail
# est renvoye vers la connexion de la plateforme. Mode autonome : un
# profil fictif choisi par son identifiant, sans mot de passe.

class Connexion(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if settings.DEPLOYMENT_MODE == "integrated":
            return Response({"erreur": "connexion par la plateforme",
                             "redirection": settings.OIDC_CONNEXION}, status=401)
        corps = _corps(request)
        profil = profil_local(str(corps.get("identifiant") or ""))
        if not profil:
            return _erreur("identifiant ou mot de passe incorrect", 401)
        persistante = bool(corps.get("seSouvenir"))
        valeur, duree = locale.signer_session(profil["id"], persistante)
        r = Response({k: v for k, v in profil.items() if k != "identifiant"} | {"compte": True})
        r.set_cookie(locale.COOKIE, valeur, max_age=duree if persistante else None,
                     httponly=True, samesite="Lax", path="/")
        return r


class Session(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user:
            return _erreur("aucune session", 401)
        return Response(request.user.profil_portail())


class Deconnexion(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        corps = {"deconnecte": True}
        if settings.DEPLOYMENT_MODE == "integrated":
            corps["redirection"] = settings.OIDC_DECONNEXION
        r = Response(corps)
        r.delete_cookie(locale.COOKIE, path="/")
        return r


# ── Comptes rendus en cours ────────────────────────────────────────────
# Ranges sous l'id du principal : chacun ne voit que les siens.

class BrouillonsListe(APIView):
    def get(self, request):
        _autoriser(request, COMPTE_RENDU, "*", "list")
        brouillons, supprimes = stockage.lister(request.user.id)
        return Response({"brouillons": brouillons, "supprimes": supprimes})


class BrouillonDetail(APIView):
    def _existant(self, request, ident):
        return Brouillon.objects.filter(owner=request.user.id, ident=ident).first()

    def get(self, request, ident):
        if not stockage.valide(ident):
            return _erreur("requete invalide", 400)
        b = self._existant(request, ident)
        if not b:
            return _erreur("introuvable", 404)
        _autoriser(request, COMPTE_RENDU, ident, "read", b.owner, b.scope_node, b.brand)
        return Response(b.contenu)

    def put(self, request, ident):
        if not stockage.valide(ident) or not isinstance(request.data, dict):
            return _erreur("requete invalide", 400)
        b = self._existant(request, ident)
        if b:
            _autoriser(request, COMPTE_RENDU, ident, "update", b.owner, b.scope_node, b.brand)
        else:
            _autoriser(request, COMPTE_RENDU, ident, "create", None, *perimetre_du_contenu(request.data))
        garde, ecrit = stockage.ecrire(request.user.id, ident, request.data)
        return Response({"ecrit": ecrit, "brouillon": garde})

    def delete(self, request, ident):
        if not stockage.valide(ident):
            return _erreur("requete invalide", 400)
        b = self._existant(request, ident)
        _autoriser(request, COMPTE_RENDU, ident, "delete",
                   *((b.owner, b.scope_node, b.brand) if b else ()))
        stockage.supprimer(request.user.id, ident)
        return Response({"supprime": True})


# ── Photos ─────────────────────────────────────────────────────────────

class PhotoEnvoi(APIView):
    def post(self, request):
        """Recoit une photo, la reduit et renvoie son identifiant.

        Le corps de la requete est l'image elle-meme : l'apercu n'echange
        ensuite plus que l'identifiant.
        """
        donnees = request.body
        if not donnees:
            return _erreur("image attendue", 400)
        _autoriser(request, PHOTO, "_new", "create")
        try:
            sortie = photos.enregistrer(donnees, CACHE)
        except Exception as e:  # noqa: BLE001 — fichier illisible
            return _erreur(str(e), 400)
        Photo.objects.get_or_create(owner=request.user.id, ident=sortie["id"])
        return Response(sortie)


class PhotoServie(APIView):
    def get(self, request, ident):
        p = Photo.objects.filter(owner=request.user.id, ident=ident).first()
        if not p:
            return _erreur("introuvable", 404)
        _autoriser(request, PHOTO, ident, "read", p.owner, p.scope_node, p.brand)
        chemin = photos._chemin(ident, CACHE)
        if not chemin:
            return _erreur("introuvable", 404)
        r = FileResponse(open(chemin, "rb"), content_type="image/jpeg")
        # Pas de cache d'un an : une photo un temps servie vide restait vide
        # dans le navigateur apres sa reparation.
        r["Cache-Control"] = "private, no-cache"
        return r


# ── Rendu ──────────────────────────────────────────────────────────────

class Page(APIView):
    def post(self, request):
        """L'image d'une diapositive, pour le mode apercu."""
        _autoriser(request, RENDU, "service", "render")
        corps = _corps(request)
        diapo = corps.get("diapo")
        if not isinstance(diapo, int):
            return _erreur("diapo attendue (entier)", 400)
        try:
            chemin = image_de(diapo, corps.get("valeurs") or {})
        except Exception as e:  # noqa: BLE001 — l'interface affiche le motif
            return _erreur(str(e), 500)
        return FileResponse(open(chemin, "rb"), content_type="image/png")


def _fichier(chemin, nom):
    return FileResponse(open(chemin, "rb"), as_attachment=True, filename=nom)


class Document(APIView):
    def post(self, request):
        """Le rapport complet, une fois la relecture terminee."""
        _autoriser(request, RENDU, "service", "render")
        corps = _corps(request)
        parties = corps.get("parties") or []
        if not parties:
            return _erreur("aucune partie retenue", 400)
        try:
            chemin = document(
                parties, corps.get("valeurs") or {},
                corps.get("nbJours") or 0, corps.get("nbParticipants") or 0,
                corps.get("format") or "pptx", corps.get("variantes"))
        except Exception as e:  # noqa: BLE001
            return _erreur(str(e), 500)
        return _fichier(chemin, f"rapport{Path(chemin).suffix}")


def _pages(corps):
    return [p for p in corps.get("pages") or [] if isinstance(p, dict) and p.get("diapo")]


def _format(corps):
    return "pdf" if corps.get("format") == "pdf" else "pptx"


class RapportComplet(APIView):
    def post(self, request):
        """Le rapport termine : chaque page avec ses propres valeurs."""
        _autoriser(request, RENDU, "service", "render")
        corps = _corps(request)
        pages = _pages(corps)
        if not pages:
            return _erreur("aucune page", 400)
        try:
            chemin = rapport(pages, _format(corps))
        except Exception as e:  # noqa: BLE001
            return _erreur(str(e), 500)
        return _fichier(chemin, f"rapport{Path(chemin).suffix}")


class RapportLancer(APIView):
    def post(self, request):
        """Lance la production du rapport ; renvoie l'identifiant a suivre."""
        _autoriser(request, RENDU, "service", "render")
        corps = _corps(request)
        pages = _pages(corps)
        if not pages:
            return _erreur("aucune page", 400)
        tache = taches.creer(request.user.id, _format(corps))
        taches.lancer_en_fond(taches.produire, tache.id, rapport, pages, tache.format)
        return Response({"id": tache.id}, status=status.HTTP_202_ACCEPTED)


def _tache(request, ident):
    t = TacheRapport.objects.filter(id=ident, owner=request.user.id).first()
    if t:
        _autoriser(request, RENDU, ident, "read", t.owner)
    return t


class RapportEtat(APIView):
    def get(self, request, ident):
        t = _tache(request, ident)
        if not t:
            return _erreur("introuvable", 404)
        etat = taches.etat(t)
        return Response({"etat": etat, **({"erreur": t.erreur} if etat == "echec" else {})})


class RapportFichier(APIView):
    def get(self, request, ident):
        t = _tache(request, ident)
        if not t or taches.etat(t) != "pret" or not Path(t.chemin).exists():
            return _erreur("rapport indisponible", 404)
        return _fichier(t.chemin, f"rapport.{t.format}")


# ── Redaction ──────────────────────────────────────────────────────────

class Redaction(APIView):
    def post(self, request):
        """Une proposition de texte, a partir des chiffres d'un stagiaire ou d'une session.

        Le moteur s'appuie sur les tournures relevees dans les comptes rendus
        existants. Le texte renvoye est un brouillon : c'est le formateur qui
        le signe, et la reponse porte `relecture_requise` pour le rappeler.
        """
        _autoriser(request, RENDU, "service", "redact")
        corps = _corps(request)
        quoi = corps.get("type") or "fiche"
        # Une certification : modules et e-learning, pas de progression.
        if quoi == "bilan_certification":
            return Response({"rubriques": rediger_bilan_certification(
                corps.get("session") or {}, corps.get("graine"), corps.get("rubrique")),
                "relecture_requise": True})
        if quoi == "certification":
            sortie = rediger_appreciation_certification(corps.get("participant") or {}, corps.get("graine"))
            if not sortie["texte"]:
                return _erreur("chiffres insuffisants", 400)
            return Response(sortie)
        # Les remarques de session : la graine vient de l'interface, une
        # nouvelle a chaque « Autre proposition ».
        if quoi in ("progression", "acquisition", "bilan"):
            session, graine = corps.get("session") or {}, corps.get("graine")
            if quoi == "bilan":
                return Response({"rubriques": rediger_bilan(session, graine, corps.get("rubrique")),
                                 "relecture_requise": True})
            texte = (rediger_progression if quoi == "progression"
                     else rediger_acquisition)(session, graine)
            if not texte:
                return _erreur("chiffres insuffisants", 400)
            return Response({"texte": texte, "relecture_requise": True})
        participant = corps.get("participant") or {}
        genre = corps.get("genre") or participant.get("genre")
        if genre:
            participant["genre"] = genre
        try:
            # « accueil » : l'appreciation du formateur sur la fiche (page 27),
            # une tournure nouvelle a chaque graine.
            sortie = (rediger_appreciation(participant, corps.get("graine")) if quoi == "accueil"
                      else rediger(participant, corps.get("longueur", "standard")))
        except Exception as erreur:      # le moteur refuse une entree vide
            return _erreur(str(erreur), 400)
        return Response(sortie)
