"""Titres anglais du catalogue, indexés par intitulé français.

Le fichier de travail métier n'a qu'une colonne d'intitulé, en français. Plutôt
que de faire retraduire ce qui l'est déjà, on rapproche le catalogue de campagne
de celui publié sur la vitrine — c'est le même catalogue, vu par deux canaux.

**L'index porte sur l'intitulé, pas sur le code.** `TP01` et `TP02` désignent des
formations différentes — et même inversées — selon la famille, et `PART01` a deux
libellés : c'est le rappel, appliqué ici, que le code seul n'est jamais une clé
dans ce catalogue. Un index sur le code leur donnerait la même traduction, fausse
et silencieuse.

La table est une **donnée**, pas du code : `referential/data/titles_en.json`,
régénérable par `scripts/build-titles-en.mjs` et complétable à la main pour les
formations que la vitrine ne publie pas.

Un intitulé sans traduction n'est pas une erreur : la ligne s'affiche en français.
Bloquer l'import pour un titre manquant coûterait une campagne entière.
"""
from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parents[2] / "referential" / "data" / "titles_en.json"

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def normalize_title(value: str | None) -> str:
    """Clé de rapprochement — doit rester identique à `normTitle` côté JS.

    Le même intitulé s'écrit avec une apostrophe droite ou typographique, un tiret
    court ou un tiret cadratin, une majuscule de plus. Comparer sur le texte brut
    ferait manquer la moitié des correspondances.
    """
    if not value:
        return ""
    decomposed = unicodedata.normalize("NFD", str(value))
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return _NON_ALNUM.sub(" ", stripped.lower()).strip()


@lru_cache(maxsize=1)
def titles() -> dict[str, str]:
    if not DATA_FILE.exists():
        return {}
    payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    return {
        normalize_title(french): english
        for french, english in payload.get("titles", {}).items()
    }


def english_title(french_title: str | None) -> str:
    return titles().get(normalize_title(french_title), "")
