# -*- coding: utf-8 -*-
"""L'interface HTTP du service d'apercu.

Trois routes, appelees par l'assistant de compte rendu :

    GET  /apercu/sante              le service repond-il, LibreOffice est-il la
    POST /apercu/page               l'image d'une diapositive
    POST /apercu/document           le rapport complet (pptx ou pdf)
    POST /apercu/rapport            le rapport complet, page par page

S'y ajoutent les comptes rendus en cours et leurs photos, conserves pour
qu'un formateur les retrouve sur tout poste du reseau
(`/cr-donnees/...`, voir `stockage.py`).

Tout demande une session ouverte par le formulaire de connexion
(`/cr-donnees/connexion`, voir `comptes.py`) : chaque formateur ne voit
que ses propres comptes rendus.
"""

from pathlib import Path

import os
import re
import sys
import threading
import time
import uuid
from flask import Flask, g, jsonify, request, send_file

import comptes
import photos
import stockage
from service import CACHE, MODELE, SOFFICE, document, image_de, rapport

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'redaction'))
from moteur import rediger  # noqa: E402
from moteur_certification import (rediger_appreciation_certification,  # noqa: E402
                                  rediger_bilan_certification)
from moteur_fiche import rediger_appreciation  # noqa: E402
from moteur_session import (rediger_acquisition, rediger_bilan,  # noqa: E402
                            rediger_progression)

app = Flask(__name__)


@app.get('/apercu/sante')
def sante():
    return jsonify({
        'pret': Path(MODELE).exists() and Path(SOFFICE).exists(),
        'modele': Path(MODELE).name,
        'libreoffice': Path(SOFFICE).exists(),
    })


@app.post('/apercu/page')
def page():
    """L'image d'une diapositive, pour le mode apercu."""
    corps = request.get_json(force=True) or {}
    diapo = corps.get('diapo')
    if not isinstance(diapo, int):
        return jsonify({'erreur': 'diapo attendue (entier)'}), 400
    try:
        chemin = image_de(diapo, corps.get('valeurs') or {})
    except Exception as e:  # noqa: BLE001 — l'interface affiche le motif
        return jsonify({'erreur': str(e)}), 500
    return send_file(chemin, mimetype='image/png')


@app.post('/apercu/photo')
def photo():
    """Recoit une photo, la reduit et renvoie son identifiant.

    Le corps de la requete est l'image elle-meme : l'apercu n'echange
    ensuite plus que l'identifiant.
    """
    donnees = request.get_data()
    if not donnees:
        return jsonify({'erreur': 'image attendue'}), 400
    try:
        return jsonify(photos.enregistrer(donnees, CACHE))
    except Exception as e:  # noqa: BLE001 — fichier illisible
        return jsonify({'erreur': str(e)}), 400


# ── Connexion ──────────────────────────────────────────────────────────
COOKIE = 'cfao_session'
LIBRES = {'/apercu/sante', '/cr-donnees/connexion', '/cr-donnees/session',
          '/cr-donnees/deconnexion'}


@app.before_request
def _session_requise():
    """Sans session ouverte, rien d'autre que la connexion ne repond."""
    g.profil = comptes.profil_de(request.cookies.get(COOKIE))
    if request.path not in LIBRES and not g.profil:
        return jsonify({'erreur': 'connexion requise'}), 401


@app.post('/cr-donnees/connexion')
def connexion():
    corps = request.get_json(force=True, silent=True) or {}
    identifiant = str(corps.get('identifiant') or '')
    try:
        profil = comptes.verifier(identifiant, str(corps.get('motDePasse') or ''))
    except PermissionError:
        return jsonify({'erreur': 'trop de tentatives, reessayez dans une minute'}), 429
    if not profil:
        return jsonify({'erreur': 'identifiant ou mot de passe incorrect'}), 401
    persistante = bool(corps.get('seSouvenir'))
    jeton, duree = comptes.ouvrir_session(identifiant, persistante)
    r = jsonify(profil)
    r.set_cookie(COOKIE, jeton, max_age=duree if persistante else None,
                 httponly=True, samesite='Lax', path='/')
    return r


@app.get('/cr-donnees/session')
def session_ouverte():
    return (jsonify(g.profil), 200) if g.profil else (jsonify({'erreur': 'aucune session'}), 401)


@app.post('/cr-donnees/deconnexion')
def deconnexion():
    comptes.fermer_session(request.cookies.get(COOKIE))
    r = jsonify({'deconnecte': True})
    r.delete_cookie(COOKIE, path='/')
    return r


# ── Comptes rendus en cours, conserves cote serveur ────────────────────
# Ranges sous l'id du profil connecte : chacun ne voit que les siens.

def _utilisateur():
    return g.profil['id']


@app.get('/cr-donnees/brouillons')
def brouillons_liste():
    u = _utilisateur()
    if not u:
        return jsonify({'erreur': 'utilisateur attendu'}), 401
    brouillons, supprimes = stockage.lister(u)
    return jsonify({'brouillons': brouillons, 'supprimes': supprimes})


@app.get('/cr-donnees/brouillons/<ident>')
def brouillon_lire(ident):
    u = _utilisateur()
    if not u or not stockage.valide(ident):
        return jsonify({'erreur': 'requete invalide'}), 400
    b = stockage.lire(u, ident)
    return (jsonify(b), 200) if b else (jsonify({'erreur': 'introuvable'}), 404)


@app.put('/cr-donnees/brouillons/<ident>')
def brouillon_ecrire(ident):
    u = _utilisateur()
    corps = request.get_json(force=True, silent=True)
    if not u or not stockage.valide(ident) or not isinstance(corps, dict):
        return jsonify({'erreur': 'requete invalide'}), 400
    garde, ecrit = stockage.ecrire(u, ident, corps)
    return jsonify({'ecrit': ecrit, 'brouillon': garde})


@app.delete('/cr-donnees/brouillons/<ident>')
def brouillon_supprimer(ident):
    u = _utilisateur()
    if not u or not stockage.valide(ident):
        return jsonify({'erreur': 'requete invalide'}), 400
    stockage.supprimer(u, ident)
    return jsonify({'supprime': True})


@app.get('/cr-donnees/photos/<ident>.jpg')
def photo_servir(ident):
    chemin = photos._chemin(ident, CACHE)
    if not chemin:
        return jsonify({'erreur': 'introuvable'}), 404
    return send_file(chemin, mimetype='image/jpeg', max_age=31536000)


@app.post('/apercu/document')
def doc():
    """Le rapport complet, une fois la relecture terminee."""
    corps = request.get_json(force=True) or {}
    parties = corps.get('parties') or []
    if not parties:
        return jsonify({'erreur': 'aucune partie retenue'}), 400
    try:
        chemin = document(
            parties, corps.get('valeurs') or {},
            corps.get('nbJours') or 0, corps.get('nbParticipants') or 0,
            corps.get('format') or 'pptx', corps.get('variantes'))
    except Exception as e:  # noqa: BLE001
        return jsonify({'erreur': str(e)}), 500
    return send_file(chemin, as_attachment=True, download_name=f'rapport{chemin.suffix}')


@app.post('/apercu/rapport')
def rapport_complet():
    """Le rapport termine : chaque page avec ses propres valeurs.

    Contrairement a `/apercu/document`, les pages repetees (jours,
    fiches individuelles) y portent chacune les leurs.
    """
    corps = request.get_json(force=True, silent=True) or {}
    pages = [p for p in corps.get('pages') or [] if isinstance(p, dict) and p.get('diapo')]
    if not pages:
        return jsonify({'erreur': 'aucune page'}), 400
    format_ = 'pdf' if corps.get('format') == 'pdf' else 'pptx'
    try:
        chemin = rapport(pages, format_)
    except Exception as e:  # noqa: BLE001
        return jsonify({'erreur': str(e)}), 500
    return send_file(chemin, as_attachment=True, download_name=f'rapport{chemin.suffix}')


# ── Production du rapport en tache de fond ──────────────────────────────
# Un rapport complet demande 40 s a plus d'une minute sans qu'un octet ne
# parte : des postes formateurs (antivirus, pare-feu, proxy) coupent une
# requete restee aussi longtemps muette, et le PowerPoint, pourtant produit,
# n'arrivait jamais. La production se lance, l'interface suit son etat par
# des requetes courtes, puis telecharge le fichier.

_TACHES = {}
_verrou_taches = threading.Lock()
_IDENT_TACHE = re.compile(r'[0-9a-f]{32}')
DUREE_TACHE = 3600  # comme les fichiers de rapport, effaces apres une heure


def _produire(ident, pages, format_):
    try:
        resultat = {'etat': 'pret', 'chemin': rapport(pages, format_)}
    except Exception as e:  # noqa: BLE001 — l'interface affiche l'echec
        resultat = {'etat': 'echec', 'erreur': str(e)}
    with _verrou_taches:
        _TACHES[ident].update(resultat)


def _tache(ident):
    if not _IDENT_TACHE.fullmatch(ident):
        return None
    with _verrou_taches:
        return dict(_TACHES.get(ident) or {}) or None


@app.post('/apercu/rapports')
def rapport_lancer():
    """Lance la production du rapport ; renvoie l'identifiant a suivre."""
    corps = request.get_json(force=True, silent=True) or {}
    pages = [p for p in corps.get('pages') or [] if isinstance(p, dict) and p.get('diapo')]
    if not pages:
        return jsonify({'erreur': 'aucune page'}), 400
    format_ = 'pdf' if corps.get('format') == 'pdf' else 'pptx'
    ident = uuid.uuid4().hex
    with _verrou_taches:
        limite = time.time() - DUREE_TACHE
        for vieux in [k for k, t in _TACHES.items() if t['debut'] < limite]:
            del _TACHES[vieux]
        _TACHES[ident] = {'etat': 'en_cours', 'debut': time.time(), 'format': format_}
    threading.Thread(target=_produire, args=(ident, pages, format_), daemon=True).start()
    return jsonify({'id': ident}), 202


@app.get('/apercu/rapports/<ident>')
def rapport_etat(ident):
    t = _tache(ident)
    if not t:
        return jsonify({'erreur': 'introuvable'}), 404
    return jsonify({'etat': t['etat'], **({'erreur': t['erreur']} if t['etat'] == 'echec' else {})})


@app.get('/apercu/rapports/<ident>/fichier')
def rapport_fichier(ident):
    t = _tache(ident)
    if not t or t['etat'] != 'pret' or not Path(t['chemin']).exists():
        return jsonify({'erreur': 'rapport indisponible'}), 404
    return send_file(t['chemin'], as_attachment=True, download_name=f"rapport.{t['format']}")


@app.post('/apercu/redaction')
def redaction():
    """Une proposition d'appreciation, a partir des chiffres d'un stagiaire.

    Le moteur s'appuie sur les tournures relevees dans les comptes rendus
    existants. Le texte renvoye est un brouillon : c'est le formateur qui
    le signe, et la reponse porte `relecture_requise` pour le rappeler.
    """
    corps = request.get_json(force=True) or {}
    quoi = corps.get('type') or 'fiche'
    # Une certification : modules et e-learning, pas de progression.
    if quoi == 'bilan_certification':
        return jsonify({'rubriques': rediger_bilan_certification(
            corps.get('session') or {}, corps.get('graine'), corps.get('rubrique')),
            'relecture_requise': True})
    if quoi == 'certification':
        sortie = rediger_appreciation_certification(corps.get('participant') or {}, corps.get('graine'))
        if not sortie['texte']:
            return jsonify({'erreur': 'chiffres insuffisants'}), 400
        return jsonify(sortie)
    # Les remarques de session : la graine vient de l'interface, une
    # nouvelle a chaque « Autre proposition ».
    if quoi in ('progression', 'acquisition', 'bilan'):
        session, graine = corps.get('session') or {}, corps.get('graine')
        if quoi == 'bilan':
            return jsonify({'rubriques': rediger_bilan(session, graine, corps.get('rubrique')),
                            'relecture_requise': True})
        texte = (rediger_progression if quoi == 'progression'
                 else rediger_acquisition)(session, graine)
        if not texte:
            return jsonify({'erreur': 'chiffres insuffisants'}), 400
        return jsonify({'texte': texte, 'relecture_requise': True})
    participant = corps.get('participant') or {}
    genre = corps.get('genre') or participant.get('genre')
    if genre:
        participant['genre'] = genre
    try:
        # « accueil » : l'appreciation du formateur sur la fiche (page 27),
        # une tournure nouvelle a chaque graine.
        sortie = (rediger_appreciation(participant, corps.get('graine')) if quoi == 'accueil'
                  else rediger(participant, corps.get('longueur', 'standard')))
    except Exception as erreur:      # le moteur refuse une entree vide
        return jsonify({'erreur': str(erreur)}), 400
    return jsonify(sortie)


if __name__ == '__main__':
    # Poste de dev : boucle locale seulement. En conteneur, CR_HOTE=0.0.0.0
    # et la passerelle est le seul point d'entree.
    app.run(host=os.environ.get('CR_HOTE', '127.0.0.1'),
            port=int(os.environ.get('CR_PORT', '5175')))
