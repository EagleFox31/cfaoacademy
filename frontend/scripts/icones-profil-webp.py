"""Icônes de profil du portail : WebP de 768 px à côté des PNG d'origine.

Les PNG (1254 px, ~2 Mo chacun) restent les sources ; le portail affiche les
WebP (src/utils/resolveProfileIcon.js). Idempotent : une icône déjà convertie
et plus récente que sa source n'est pas réécrite.

    python frontend/scripts/icones-profil-webp.py      (Pillow requis)
"""
from pathlib import Path

from PIL import Image

DOSSIER = Path(__file__).resolve().parents[2] / "assets"
ICONES = ["technicieng1", "technicieng2", "technicieng3", "technicienG4", "KI",
          "chef-equipe", "chef-atelier", "dps-blanc", "dps-noir", "dop-blanc",
          "dop-noir", "icone_technicien"]
COTE = 768

for nom in ICONES:
    src, dst = DOSSIER / f"{nom}.png", DOSSIER / f"{nom}.webp"
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        continue
    with Image.open(src) as img:
        img.thumbnail((COTE, COTE), Image.LANCZOS)
        img.save(dst, "WEBP", quality=82, method=6)
    print(f"{nom}: {src.stat().st_size // 1024} Ko -> {dst.stat().st_size // 1024} Ko")
