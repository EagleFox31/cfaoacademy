# -*- coding: utf-8 -*-
"""L'interface HTTP du service d'apercu.

Trois routes, appelees par l'assistant de compte rendu :

    GET  /apercu/sante              le service repond-il, LibreOffice est-il la
    POST /apercu/page               l'image d'une diapositive
    POST /apercu/document           le rapport complet (pptx ou pdf)

S'y ajoutent les comptes rendus en cours et leurs photos, conserves pour
qu'un formateur les retrouve sur tout poste du reseau
(`/cr-donnees/...`, voir `stockage.py`).
"""

from pathlib import Path

import sys
from flask import Flask, jsonify, request, send_file

import photos
import stockage
from service import CACHE, MODELE, SOFFICE, document, image_de

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'redaction'))
from moteur import rediger  # noqa: E402
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


# ── Comptes rendus en cours, conserves cote serveur ────────────────────
# L'utilisateur est celui du compte de demonstration, transmis par
# l'interface : pas d'authentification encore, reseau local seulement.

def _utilisateur():
    u = request.headers.get('X-Utilisateur', '')
    return u if stockage.valide(u) else None


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


@app.post('/apercu/redaction')
def redaction():
    """Une proposition d'appreciation, a partir des chiffres d'un stagiaire.

    Le moteur s'appuie sur les tournures relevees dans les comptes rendus
    existants. Le texte renvoye est un brouillon : c'est le formateur qui
    le signe, et la reponse porte `relecture_requise` pour le rappeler.
    """
    corps = request.get_json(force=True) or {}
    quoi = corps.get('type') or 'fiche'
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
    app.run(host='127.0.0.1', port=5175)
