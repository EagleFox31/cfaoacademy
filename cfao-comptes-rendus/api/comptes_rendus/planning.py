"""Copie locale des sessions du planning (contrat `cr-sessions` ^1, consommateur).

Le planning fait foi pour les sessions ; le module en garde une copie dans son
referentiel (`Session`, `Formation`, `Animation`) et continue de servir cette
copie quand le planning ne repond pas.

Lecture : GET conditionnel (`If-None-Match`), cle partagee `X-Cr-Sessions-Key`,
sur le reseau inter-modules. 304 = rien a faire. Chaque session porte une
`revision` : seules celles dont la revision change sont reecrites.

Regles d'ecriture :
- une session du planning est reperee par `planning_id`, jamais par son numero ;
- la formation, les dates, le lieu, le pays et les animateurs viennent du
  planning ; les stagiaires restent ceux du fichier « Liste des participants » ;
- rien n'est supprime : une session sortie de la fenetre reste dans la copie.
  Seul un animateur retire du planning disparait de sa session.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date

import requests
from django.conf import settings
from django.core.cache import cache
from django.db import transaction

from . import import_referentiel
from .models import Animation, Formation, Session

journal = logging.getLogger(__name__)

PATH = "/api/v1/planning/internal/cr-sessions"
ENTETE_CLE = "X-Cr-Sessions-Key"
JOURS = 60
DELAI = (2, 5)  # connexion, lecture (secondes) : la liste ne patiente pas plus
CLE_ETAG = "planning:cr-sessions:etag"
CLE_VERROU = "planning:cr-sessions:verrou"


class PlanningIndisponible(Exception):
    """Le planning n'a pas repondu comme le contrat le prevoit."""


def configure() -> bool:
    return bool(settings.PLANNING_API_URL and settings.CR_SESSIONS_KEY)


def lire(etag: str | None = None, jours: int = JOURS) -> tuple[str | None, dict | None]:
    """(ETag, corps) ; corps None quand le planning repond 304 (rien de neuf)."""
    entetes = {ENTETE_CLE: settings.CR_SESSIONS_KEY, "Accept": "application/json"}
    if etag:
        entetes["If-None-Match"] = etag
    try:
        r = requests.get(settings.PLANNING_API_URL + PATH, params={"days": jours},
                         headers=entetes, timeout=DELAI)
    except requests.RequestException as exc:
        raise PlanningIndisponible(f"planning injoignable : {exc.__class__.__name__}") from None
    if r.status_code == 304:
        return r.headers.get("ETag") or etag, None
    if r.status_code != 200:
        raise PlanningIndisponible(f"planning : reponse {r.status_code}")
    try:
        corps = r.json()
    except ValueError:
        raise PlanningIndisponible("planning : reponse illisible") from None
    if not isinstance(corps, dict) or not isinstance(corps.get("sessions"), list):
        raise PlanningIndisponible("planning : reponse hors contrat")
    return r.headers.get("ETag"), corps


# ── Application ────────────────────────────────────────────────────────

def _formation(s: dict) -> Formation | None:
    code = (s.get("code") or s.get("code_norm") or "").strip()[:40]
    if not code:
        return None
    libelle, marque = (s.get("title") or "")[:300], ((s.get("brand") or {}).get("label") or "")[:80]
    formation, cree = Formation.objects.get_or_create(code=code, defaults={"libelle": libelle, "marque": marque})
    # Comme l'import : on complete ce qui manque, on ne reecrit pas le catalogue.
    if not cree and ((not formation.libelle and libelle) or (not formation.marque and marque)):
        formation.libelle = formation.libelle or libelle
        formation.marque = formation.marque or marque
        formation.save()
    return formation


def _numero(s: dict, debut: date, session: Session | None) -> str:
    """Le code de la formation ; suffixe du pays si un autre la porte deja a la meme date."""
    base = (s.get("code") or s.get("code_norm") or "PLANNING")[:30]
    pays = ((s.get("country") or {}).get("code") or "")[:6]
    autres = Session.objects.filter(debut=debut)
    if session is not None:
        autres = autres.exclude(pk=session.pk)
    for numero in (base, f"{base}-{pays}" if pays else None):
        if numero and not autres.filter(numero=numero).exists():
            return numero
    return f"{base}-{str(s['id'])[:8]}"  # l'id du planning est unique


def _formateur_id(t: dict, profils: dict) -> str:
    # En mode integre, l'identifiant du compte est le `sub` Keycloak ; sinon,
    # le profil local reconnu au nom, comme a l'import du fichier.
    if settings.DEPLOYMENT_MODE == "integrated" and t.get("sub"):
        return str(t["sub"])[:128]
    return import_referentiel._formateur_id(t.get("name") or "", profils)


def _animations(session: Session, formateurs: list[dict], profils: dict) -> None:
    voulues = {}
    for t in formateurs:
        nom = " ".join(str(t.get("name") or "").split())[:160]
        if nom:
            voulues[import_referentiel.normaliser(nom)] = (nom, _formateur_id(t, profils))
    for a in Animation.objects.filter(session=session):
        cle = import_referentiel.normaliser(a.nom_fichier)
        if cle not in voulues:
            a.delete()
            continue
        _nom, fid = voulues.pop(cle)
        # Un rattachement fait a la main par l'administrateur n'est pas ecrase par un vide.
        if fid and a.formateur_id != fid:
            a.formateur_id = fid
            a.save()
    for nom, fid in voulues.values():
        Animation.objects.create(session=session, nom_fichier=nom, formateur_id=fid)


def appliquer(corps: dict) -> dict:
    """Ecrit la copie ; renvoie le compte des sessions creees, mises a jour, inchangees, ignorees."""
    compte = {"creees": 0, "mises_a_jour": 0, "inchangees": 0, "ignorees": 0}
    profils = import_referentiel._index_profils()
    for s in corps.get("sessions") or []:
        try:
            pid = uuid.UUID(str(s["id"]))
            debut = date.fromisoformat(s["start_date"])
            fin = date.fromisoformat(s.get("end_date") or s["start_date"])
        except (KeyError, TypeError, ValueError):
            compte["ignorees"] += 1
            continue
        revision = str(s.get("revision") or "")[:40]
        session = Session.objects.filter(planning_id=pid).first()
        if session is not None and revision and session.planning_revision == revision:
            compte["inchangees"] += 1
            continue
        with transaction.atomic():
            champs = {
                "formation": _formation(s),
                "debut": debut,
                "fin": max(fin, debut),
                "lieu": (s.get("location") or "")[:200],
                "pays": import_referentiel.pays_normalise((s.get("country") or {}).get("label") or "")[0][:80],
                "libelle_fichier": (s.get("title") or "")[:300],
                "source": Session.PLANNING,
                "planning_revision": revision,
            }
            champs["numero"] = _numero(s, debut, session)
            if session is None:
                session = Session.objects.create(planning_id=pid, **champs)
                compte["creees"] += 1
            else:
                for k, v in champs.items():
                    setattr(session, k, v)
                session.save()
                compte["mises_a_jour"] += 1
            _animations(session, s.get("trainers") or [], profils)
    return compte


def synchroniser() -> dict | None:
    """Une lecture du planning et son application ; None si rien de neuf (304)."""
    etag, corps = lire(cache.get(CLE_ETAG))
    if corps is None:
        return None
    compte = appliquer(corps)
    if etag:
        cache.set(CLE_ETAG, etag, timeout=None)
    return compte


def rafraichir_si_du() -> None:
    """A l'ouverture de la liste : au plus une lecture par intervalle, jamais d'echec visible.

    Planning arrete ou hors contrat : la copie locale est servie telle quelle.
    """
    if not configure() or not cache.add(CLE_VERROU, 1, timeout=settings.PLANNING_SYNC_INTERVALLE):
        return
    try:
        compte = synchroniser()
        if compte:
            journal.info("copie du planning : %s", compte)
    except PlanningIndisponible as exc:
        journal.warning("copie du planning non rafraichie : %s", exc)
    except Exception:  # noqa: BLE001 - la liste ne tombe jamais a cause de la copie
        journal.exception("copie du planning en echec")
