"""Variantes WebP multi-largeurs et flou d'attente pour les images de `assets/`.

Pour chaque JPG/PNG de `assets/` (hors logos, drapeaux et vidéos), écrit
`assets/_r/<chemin sans extension>-<largeur>.webp` en 480, 960 et 1600 px
(seulement les largeurs inférieures à l'original), puis le manifeste
`frontend/src/data/imagesResponsives.json` : dimensions, largeurs produites et
miniature floue de 16 px en data URI. Le front le lit via
`src/utils/imageResponsive.js` (srcset des cartes, fond du portail et du hero).

Idempotent : une variante plus récente que sa source n'est pas réécrite, une
entrée déjà à jour est reprise telle quelle, et le manifeste n'est réécrit que
si son contenu change. Une image supprimée disparaît du manifeste et ses
variantes sont effacées.

    python frontend/scripts/images-responsives.py      (Pillow requis)
"""
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

RACINE = Path(__file__).resolve().parents[2]
ASSETS = RACINE / "assets"
SORTIE = ASSETS / "_r"
MANIFESTE = RACINE / "frontend" / "src" / "data" / "imagesResponsives.json"

LARGEURS = (480, 960, 1600)
EXCLUS = {"_r", "logos", "flags", "videos_articles"}
EXTENSIONS = {".jpg", ".jpeg", ".png"}
COTE_FLOU = 16


def sources():
    for chemin in sorted(ASSETS.rglob("*")):
        rel = chemin.relative_to(ASSETS)
        if chemin.is_file() and chemin.suffix.lower() in EXTENSIONS and rel.parts[0] not in EXCLUS:
            yield chemin, rel.as_posix()


def variante(rel, largeur):
    return SORTIE / f"{rel.rsplit('.', 1)[0]}-{largeur}.webp"


def largeurs_pour(largeur_source):
    retenues = [w for w in LARGEURS if w < largeur_source]
    return retenues or [largeur_source]


def a_jour(chemin, rel, entree):
    if not entree:
        return False
    mtime = chemin.stat().st_mtime
    return all(variante(rel, w).exists() and variante(rel, w).stat().st_mtime >= mtime for w in entree["v"])


def miniature(img):
    petit = img.copy()
    petit.thumbnail((COTE_FLOU, COTE_FLOU), Image.LANCZOS)
    tampon = io.BytesIO()
    petit.save(tampon, "WEBP", quality=40, method=6)
    return "data:image/webp;base64," + base64.b64encode(tampon.getvalue()).decode("ascii")


def traiter(chemin, rel):
    with Image.open(chemin) as ouverte:
        img = ImageOps.exif_transpose(ouverte)
        img = img.convert("RGBA" if "A" in img.getbands() or "transparency" in img.info else "RGB")
        largeur, hauteur = img.size
        retenues = largeurs_pour(largeur)
        for w in retenues:
            dst = variante(rel, w)
            if dst.exists() and dst.stat().st_mtime >= chemin.stat().st_mtime:
                continue
            dst.parent.mkdir(parents=True, exist_ok=True)
            copie = img if w == largeur else img.resize((w, round(hauteur * w / largeur)), Image.LANCZOS)
            copie.save(dst, "WEBP", quality=78, method=4)
        return {"w": largeur, "h": hauteur, "v": retenues, "f": miniature(img)}


def main():
    ancien = json.loads(MANIFESTE.read_text("utf-8")) if MANIFESTE.exists() else {}
    vu, nouveau = {}, {}
    for chemin, rel in sources():
        cle_sortie = rel.rsplit(".", 1)[0].lower()
        if cle_sortie in vu:
            sys.exit(f"collision de variantes : {vu[cle_sortie]} et {rel}")
        vu[cle_sortie] = rel
        entree = ancien.get(rel)
        nouveau[rel] = entree if a_jour(chemin, rel, entree) else traiter(chemin, rel)
        if nouveau[rel] is not entree:
            print(f"{rel}: {nouveau[rel]['v']}")

    attendues = {variante(rel, w) for rel, e in nouveau.items() for w in e["v"]}
    for orpheline in [p for p in SORTIE.rglob("*.webp") if p not in attendues]:
        orpheline.unlink()
        print(f"supprimée : {orpheline.relative_to(ASSETS).as_posix()}")

    texte = json.dumps(nouveau, ensure_ascii=False, indent=0, sort_keys=True) + "\n"
    if not MANIFESTE.exists() or MANIFESTE.read_text("utf-8") != texte:
        MANIFESTE.write_text(texte, "utf-8", newline="\n")
        print(f"manifeste : {len(nouveau)} images")


if __name__ == "__main__":
    main()
