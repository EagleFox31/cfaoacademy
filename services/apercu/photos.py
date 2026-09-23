# -*- coding: utf-8 -*-
"""Les photos du compte rendu : reception, puis pose dans les diapositives.

Le navigateur ne tient ses photos que sous des adresses `blob:`, que le
service ne peut pas lire. Chaque photo lui est donc envoyee une fois ;
il la garde sous l'empreinte de son contenu et l'apercu n'echange plus
ensuite que cet identifiant — renvoyer l'image a chaque frappe ferait
transiter des megaoctets pour une virgule.

A la reception, la photo est ramenee a une taille d'impression : un
cliche de telephone depasse souvent 4000 pixels quand une case de
diapositive en affiche moins de 1500. C'est ce qui garde le document
final a un poids raisonnable.

Dans la diapositive, les emplacements du modele (« Emplacement photo »)
delimitent le cadre reserve aux images. On les retire et on pose les
photos dans ce cadre selon la disposition choisie par le formateur,
chacune rognee pour remplir sa case sans se deformer.
"""
import hashlib
import io
import re
from pathlib import Path

from PIL import Image, ImageOps

# Le plus grand cote conserve : assez pour une case pleine largeur
# imprimee, sans garder la definition d'un capteur de telephone.
COTE_MAX = 1600
QUALITE = 85

# L'espace entre deux photos, celui que le modele laisse entre ses deux
# emplacements de la diapositive 9.
ECART = 125000

NOM_EMPLACEMENT = 'Emplacement photo'
TYPE_IMAGE = ('http://schemas.openxmlformats.org/officeDocument/2006/'
              'relationships/image')


def dossier(cache):
    d = Path(cache) / 'photos'
    d.mkdir(parents=True, exist_ok=True)
    return d


def enregistrer(donnees, cache):
    """Garde une photo reduite, et renvoie son identifiant et sa taille."""
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(donnees)))
    image = image.convert('RGB')
    image.thumbnail((COTE_MAX, COTE_MAX))
    tampon = io.BytesIO()
    image.save(tampon, 'JPEG', quality=QUALITE, optimize=True)
    brut = tampon.getvalue()
    ident = hashlib.sha1(brut).hexdigest()[:16]
    chemin = dossier(cache) / f'{ident}.jpg'
    if not chemin.exists():
        chemin.write_bytes(brut)
    return {'id': ident, 'largeur': image.width, 'hauteur': image.height}


def _chemin(ident, cache):
    if not re.fullmatch(r'[0-9a-f]{16}', str(ident)):
        return None
    chemin = dossier(cache) / f'{ident}.jpg'
    return chemin if chemin.exists() else None


RE_FORME = re.compile(r'<p:sp>(?:(?!</p:sp>).)*?</p:sp>', re.S)
RE_POSITION = re.compile(
    r'<a:off x="(\d+)" y="(\d+)"/><a:ext cx="(\d+)" cy="(\d+)"/>')


def emplacements(xml):
    """Les formes « Emplacement photo » d'une diapositive, avec leur position."""
    trouvees = []
    for m in RE_FORME.finditer(xml):
        if f'name="{NOM_EMPLACEMENT}' not in m.group(0):
            continue
        pos = RE_POSITION.search(m.group(0))
        if pos:
            trouvees.append((m, tuple(int(v) for v in pos.groups())))
    return trouvees


def cadre(positions):
    """Le rectangle qui englobe les emplacements du modele."""
    x0 = min(p[0] for p in positions)
    y0 = min(p[1] for p in positions)
    x1 = max(p[0] + p[2] for p in positions)
    y1 = max(p[1] + p[3] for p in positions)
    return x0, y0, x1 - x0, y1 - y0


def case(cadre_, r):
    """Une case de la disposition, en EMU, ecartee de ses voisines.

    La disposition est donnee en fractions du cadre. Un bord interieur
    recule d'un demi-ecart ; un bord colle au cadre ne bouge pas, pour
    que les photos occupent le cadre entier.
    """
    x0, y0, l, h = cadre_
    gauche, haut = r['x'], r['y']
    droite, bas = r['x'] + r['l'], r['y'] + r['h']
    demi = ECART / 2
    ax = x0 + gauche * l + (demi if gauche > 0.001 else 0)
    ay = y0 + haut * h + (demi if haut > 0.001 else 0)
    bx = x0 + droite * l - (demi if droite < 0.999 else 0)
    by = y0 + bas * h - (demi if bas < 0.999 else 0)
    return round(ax), round(ay), round(bx - ax), round(by - ay)


def rognage(image_l, image_h, case_l, case_h):
    """Le `srcRect` qui fait remplir la case sans deformer l'image.

    Les valeurs sont en millemes de pourcent, retires de chaque bord.
    """
    ratio_image = image_l / image_h
    ratio_case = case_l / case_h
    if ratio_image > ratio_case:
        part = int((1 - ratio_case / ratio_image) / 2 * 100000)
        return f'<a:srcRect l="{part}" r="{part}"/>'
    part = int((1 - ratio_image / ratio_case) / 2 * 100000)
    return f'<a:srcRect t="{part}" b="{part}"/>'


def forme_image(ident_forme, nom, rid, pos, rect):
    x, y, l, h = pos
    return (
        f'<p:pic><p:nvPicPr><p:cNvPr id="{ident_forme}" name="{nom}"/>'
        '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/>'
        f'</p:nvPicPr><p:blipFill><a:blip r:embed="{rid}"/>{rect}'
        '<a:stretch><a:fillRect/></a:stretch></p:blipFill>'
        f'<p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{l}" cy="{h}"/>'
        '</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
        '</p:pic>')


def poser(contenus, slide, photos, cache):
    """Pose les photos dans la diapositive `slide` du paquet `contenus`.

    `photos` est la liste des `{id, x, y, l, h}` de la disposition, dans
    l'ordre du formateur. Une photo inconnue du service est ignoree ;
    sans aucune photo lisible, les emplacements du modele restent, comme
    toute donnee manquante.
    """
    lisibles = [(p, _chemin(p.get('id'), cache)) for p in photos or []]
    lisibles = [(p, c) for p, c in lisibles if c]
    if not lisibles:
        return
    xml = contenus[slide].decode('utf-8')
    trouves = emplacements(xml)
    if not trouves:
        return
    cadre_ = cadre([pos for _, pos in trouves])

    rels_nom = slide.replace('slides/', 'slides/_rels/') + '.rels'
    rels = contenus[rels_nom].decode('utf-8')
    base = Path(slide).stem
    ident_forme = 900
    formes = []
    for i, (p, chemin) in enumerate(lisibles):
        media = f'ppt/media/{base}_photo{i + 1}.jpg'
        contenus[media] = chemin.read_bytes()
        rid = f'rIdPhoto{i + 1}'
        rels = rels.replace(
            '</Relationships>',
            f'<Relationship Id="{rid}" Type="{TYPE_IMAGE}" '
            f'Target="../media/{Path(media).name}"/></Relationships>')
        pos = case(cadre_, p)
        with Image.open(chemin) as image:
            rect = rognage(image.width, image.height, pos[2], pos[3])
        formes.append(forme_image(ident_forme + i, f'Photo {i + 1}', rid,
                                  pos, rect))

    # Les emplacements s'effacent, les photos prennent la place du premier.
    premier = trouves[0][0]
    for m, _ in reversed(trouves[1:]):
        xml = xml[:m.start()] + xml[m.end():]
    xml = xml[:premier.start()] + ''.join(formes) + xml[premier.end():]
    contenus[slide] = xml.encode('utf-8')
    contenus[rels_nom] = rels.encode('utf-8')

    types = contenus['[Content_Types].xml'].decode('utf-8')
    if 'Extension="jpg"' not in types:
        types = types.replace(
            '<Default ', '<Default Extension="jpg" ContentType="image/jpeg"/>'
            '<Default ', 1)
        contenus['[Content_Types].xml'] = types.encode('utf-8')
