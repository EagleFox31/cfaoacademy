# -*- coding: utf-8 -*-
"""L'interface HTTP du service d'apercu.

Trois routes, appelees par l'assistant de compte rendu :

    GET  /apercu/sante              le service repond-il, LibreOffice est-il la
    POST /apercu/page               l'image d'une diapositive
    POST /apercu/document           le rapport complet (pptx ou pdf)

Le service ne conserve rien entre deux appels sinon son cache d'images,
indexe par le contenu : l'assistant reste la source de verite.
"""

from pathlib import Path

from flask import Flask, jsonify, request, send_file

from service import MODELE, SOFFICE, document, image_de

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
            corps.get('format') or 'pptx')
    except Exception as e:  # noqa: BLE001
        return jsonify({'erreur': str(e)}), 500
    return send_file(chemin, as_attachment=True, download_name=chemin.name)


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5175)
