"""Réglages gunicorn, lus d'office depuis le dossier de travail de l'image.

Threads : une requête lente (clés OIDC, copie des besoins) ne bloque plus les
autres appels que le portail lance en parallèle.
Préchauffage : chaque worker charge les clés OIDC dès son démarrage, en tâche de
fond, au lieu de les chercher pendant la première requête de l'utilisateur.
"""
import threading

bind = "0.0.0.0:8000"
workers = 2
threads = 4


def post_worker_init(worker):
    from django.conf import settings

    from core.auth import jwt_verifier, prechauffage

    emetteurs = jwt_verifier.trusted_issuers(
        settings.OIDC_TRUSTED_ISSUERS, settings.OIDC_ISSUER, settings.OIDC_JWKS_URL
    )
    threading.Thread(target=prechauffage.prechauffer, args=(emetteurs,), daemon=True).start()
