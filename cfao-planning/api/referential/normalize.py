"""Normalisations partagées par les imports et le référentiel.

Une seule fonction par usage, pour que l'alias saisi par un administrateur et la
valeur lue dans le fichier soient comparés exactement de la même façon.
"""
from __future__ import annotations

import re
import unicodedata


def strip_accents(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    return "".join(c for c in text if not unicodedata.combining(c))


def norm_key(raw) -> str:
    """« Omoda & Jaecco » → « OMODA JAECCO » · « Eugène  EBENE » → « EUGENE EBENE ».

    Majuscules, sans accents, tout ce qui n'est pas lettre/chiffre devient une
    espace, espaces multiples réduites. Sert aux noms, marques et pays.
    """
    if raw is None:
        return ""
    text = strip_accents(str(raw)).upper()
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    return text.strip()


def norm_compact(raw) -> str:
    """Comme `norm_key`, sans aucune espace : « Récup » → « RECUP »."""
    return norm_key(raw).replace(" ", "")


_DASHES = "‐‑‒–—−"


def norm_code(raw) -> str:
    """Code module : « TS03 - G3 » → « TS03-G3 » · « ts 03 » → « TS03 ».

    Tirets typographiques unifiés, espaces retirées. La forme brute reste
    conservée à côté (`code_raw`) — la correction est tracée, jamais silencieuse.
    """
    if raw is None:
        return ""
    text = str(raw).strip().upper()
    for dash in _DASHES:
        text = text.replace(dash, "-")
    text = re.sub(r"\s+", "", text)
    return re.sub(r"-{2,}", "-", text).strip("-")
