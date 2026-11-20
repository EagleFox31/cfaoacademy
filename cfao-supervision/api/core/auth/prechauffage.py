"""Préchauffage des clés OIDC, propre à ce module.

Hors de jwt_verifier.py, qui reste une copie exacte de la référence cfao-core.
"""
from core.auth import jwt_verifier


def prechauffer(issuers: dict[str, str]) -> list[str]:
    """Charge les clés de chaque émetteur, pour que la première requête n'attende pas.

    Une clé injoignable n'empêche rien : la vérification la retentera à la demande.
    Renvoie les URL chargées.
    """
    chargees = []
    for url in dict.fromkeys(issuers.values()):
        try:
            jwt_verifier._client(url).get_jwk_set()
            chargees.append(url)
        except Exception:  # noqa: BLE001 — simple anticipation, jamais bloquante
            pass
    return chargees
