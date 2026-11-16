# -*- coding: utf-8 -*-
"""Regles communes aux moteurs de redaction.

Le seuil de validation est un reglage du compte rendu : la requete le
porte (`seuil`, entier de 1 a 100) et, sans lui, les moteurs gardent le
seuil CFAO historique.
"""

SEUIL_DEFAUT = 70


def seuil_de(valeur):
    """Le seuil de validation lu dans une requete, ou le seuil par defaut.

    Accepte un entier, un flottant ou une chaine numerique ; tout ce qui
    n'est pas un entier entre 1 et 100 (vide, texte, hors bornes) redonne
    `SEUIL_DEFAUT`.
    """
    if valeur is None or isinstance(valeur, bool):
        return SEUIL_DEFAUT
    try:
        n = float(str(valeur).strip().replace(',', '.')) if isinstance(valeur, str) else float(valeur)
    except (TypeError, ValueError):
        return SEUIL_DEFAUT
    if n != n or n in (float('inf'), float('-inf')):
        return SEUIL_DEFAUT
    n = int(round(n))
    return n if 1 <= n <= 100 else SEUIL_DEFAUT


def palier_au_seuil(v, seuil=SEUIL_DEFAUT):
    """Le registre d'un taux sur 100, accorde au seuil de validation.

    Sous le seuil, jamais un registre qui dirait la validation acquise ;
    au seuil ou au-dessus, jamais un registre d'echec, meme si le seuil
    choisi est bas. Les bornes 90 / 80 / 55 sont celles des lexiques.
    """
    if v is None:
        return None
    if v < seuil:
        return 'limite' if v >= 55 else 'faible'
    return 'excellent' if v >= 90 else 'bon' if v >= 80 else 'correct'
