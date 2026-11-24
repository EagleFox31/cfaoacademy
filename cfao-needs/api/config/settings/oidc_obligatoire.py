"""Audience OIDC obligatoire au démarrage (constat 12 de PLAN-durcissement.md).

Sans audience, `jwt_verifier` ne vérifie pas `aud` : un jeton émis pour une autre
API du realm serait accepté. `dev` (compose : poste et recette) et `prod` appellent
ce contrôle ; pytest utilise `config.settings.test` et n'est pas concerné.
"""
from django.core.exceptions import ImproperlyConfigured

from core.auth.jwt_verifier import audiences


def exiger_audience(brut: str, module: str) -> None:
    if not audiences(brut):
        raise ImproperlyConfigured(
            f"{module} refuse de démarrer : OIDC_AUDIENCE vide (l'audience des jetons ne serait pas vérifiée)."
        )
