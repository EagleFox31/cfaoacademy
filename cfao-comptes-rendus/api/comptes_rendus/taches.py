"""Production du rapport en tache de fond.

Un rapport complet demande 40 s a plus d'une minute sans qu'un octet ne
parte : des postes formateurs (antivirus, pare-feu, proxy) coupent une
requete restee aussi longtemps muette. La production se lance, le portail
suit son etat par des requetes courtes, puis telecharge le fichier.
"""
import logging
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

from django.db import connection

from .models import TacheRapport

journal = logging.getLogger(__name__)

DUREE_TACHE = 3600  # comme les fichiers de rapport, effaces apres une heure

# Deux rapports a la fois au plus : chacun occupe LibreOffice et la
# memoire ; les suivants attendent leur tour, toujours « en cours ».
_FILS = ThreadPoolExecutor(max_workers=2, thread_name_prefix="rapport")


def lancer_en_fond(fonction, *args):
    """Execute `fonction` dans un fil ; sa connexion a la base est refermee a la fin."""
    def executer():
        try:
            fonction(*args)
        finally:
            connection.close()
    _FILS.submit(executer)


def creer(owner, format_):
    """Une nouvelle tache en cours ; les taches de plus d'une heure sont oubliees."""
    TacheRapport.objects.filter(debut__lt=time.time() - DUREE_TACHE).delete()
    return TacheRapport.objects.create(id=uuid.uuid4().hex, owner=owner, format=format_,
                                       etat="en_cours", debut=time.time())


def produire(ident, rapport, pages, format_):
    """Produit le rapport et note le resultat ; `rapport` vient de `rendu/service.py`."""
    try:
        resultat = {"etat": "pret", "chemin": str(rapport(pages, format_))}
    except Exception:  # noqa: BLE001 — le portail affiche l'echec
        # La cause reste dans le journal du service : le portail n'en
        # montre qu'un message generique.
        journal.exception("rapport %s en echec", ident)
        resultat = {"etat": "echec", "erreur": "production du rapport impossible"}
    TacheRapport.objects.filter(id=ident).update(**resultat)


def etat(tache):
    """L'etat d'une tache ; une tache restee en cours au-dela d'une heure a echoue
    (le fil a disparu avec un redemarrage du service)."""
    if tache.etat == "en_cours" and tache.debut < time.time() - DUREE_TACHE:
        tache.etat, tache.erreur = "echec", "production interrompue"
        tache.save(update_fields=["etat", "erreur"])
    return tache.etat
