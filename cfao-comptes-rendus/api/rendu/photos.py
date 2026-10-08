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
import html
import io
import os
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

# La bande de legende sous une photo, celle des diapositives 12 a 15.
BANDE_LEGENDE = 329184
# Entre les photos et une legende commune ajoutee : la moitie d'un ecart.
ECART_LEGENDE = ECART // 2

NOM_EMPLACEMENT = 'Emplacement photo'
# La legende commune d'une page jour, sous le cadre des photos.
LEGENDE_COMMUNE = 'Legende ensemble'
TYPE_IMAGE = ('http://schemas.openxmlformats.org/officeDocument/2006/'
              'relationships/image')


# Les photos sont conservees avec les comptes rendus, pas dans le cache :
# un brouillon repris sur un autre poste les designe par leur identifiant.
PERMANENT = Path(os.environ.get(
    'CR_DONNEES', Path(__file__).resolve().parent / 'donnees')) / 'photos'


def dossier(cache=None):
    PERMANENT.mkdir(parents=True, exist_ok=True)
    return PERMANENT


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
    # Une ecriture interrompue laissait un fichier vide que le meme envoi,
    # meme identifiant, ne reparait jamais : il est recrit, et d'un bloc.
    if not _present(chemin) or chemin.stat().st_size != len(brut):
        provisoire = chemin.with_suffix('.tmp')
        provisoire.write_bytes(brut)
        os.replace(provisoire, chemin)
    return {'id': ident, 'largeur': image.width, 'hauteur': image.height}


def _present(chemin):
    """Un fichier vide n'est pas une photo : il ferait echouer tout l'apercu."""
    return chemin.is_file() and chemin.stat().st_size > 0


def _chemin(ident, cache=None):
    if not re.fullmatch(r'[0-9a-f]{16}', str(ident)):
        return None
    chemin = dossier() / f'{ident}.jpg'
    if _present(chemin):
        return chemin
    # Photos envoyees avant le stockage permanent : encore dans le cache.
    ancien = Path(cache) / 'photos' / f'{ident}.jpg' if cache else None
    return ancien if ancien and _present(ancien) else None


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


def rognage(image_l, image_h, case_l, case_h, cadrage=None):
    """Le `srcRect` qui fait remplir la case sans deformer l'image.

    Les valeurs sont en millemes de pourcent, retires de chaque bord.
    Le cadrage choisi par le formateur (`{x, y}` en pourcentages, comme
    `object-position` dans l'editeur) repartit la partie retiree entre
    les deux bords : a 0, tout est pris a droite ou en bas.
    """
    cadrage = cadrage or {}
    ratio_image = image_l / image_h
    ratio_case = case_l / case_h

    def partage(retire, pct):
        avant = retire * min(100, max(0, float(pct))) / 100
        return int(avant * 100000), int((retire - avant) * 100000)

    if ratio_image > ratio_case:
        g, d = partage(1 - ratio_case / ratio_image, cadrage.get('x', 50))
        return f'<a:srcRect l="{g}" r="{d}"/>'
    h, b = partage(1 - ratio_image / ratio_case, cadrage.get('y', 50))
    return f'<a:srcRect t="{h}" b="{b}"/>'


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


def forme_legende(ident_forme, rang, pos, texte):
    """La legende d'une photo, dans le style des diapositives 12 a 15."""
    x, y, l, h = pos
    return (
        f'<p:sp><p:nvSpPr><p:cNvPr id="{ident_forme}" name="Legende {rang}"/>'
        '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>'
        f'<a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{l}" cy="{h}"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>'
        '<p:txBody><a:bodyPr wrap="square" lIns="0" rIns="0" tIns="0" bIns="0" '
        'rtlCol="0" anchor="ctr"><a:normAutofit/></a:bodyPr><a:lstStyle/>'
        '<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="fr-FR" sz="1200" dirty="0">'
        '<a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:rPr>'
        f'<a:t>{html.escape(texte, quote=False)}</a:t></a:r></a:p></p:txBody></p:sp>')


def poser(contenus, slide, photos, cache, legendes=None, commune=''):
    """Pose les photos dans la diapositive `slide` du paquet `contenus`.

    `photos` est la liste des `{id, x, y, l, h}` de la disposition, dans
    l'ordre du formateur, avec au besoin son `cadrage` et sa `legende`.
    Une photo qui porte une cle `legende` cede le bas de sa case a une
    bande de legende.

    `legendes` dit ou vont les legendes, choisies a part de la
    disposition : `aucune` (les photos prennent tout le cadre), `chaque`
    (une bande par photo) ou `commune` (une bande sous l'ensemble, qui
    porte `commune`). La page jour a deja sa bande commune, « Legende
    ensemble », remplie par son drapeau : elle ne reste qu'en mode
    `commune`, et rejoint le cadre des photos sinon. Les autres pages
    n'en ont pas : le mode `commune` la cree au bas du cadre. Sans mode
    (ancien appel), seule une photo legendee retire la bande commune.

    Une photo inconnue du service est ignoree ; sans aucune photo
    lisible, les emplacements du modele restent, comme toute donnee
    manquante.
    """
    lisibles = [(p, _chemin(p.get('id'), cache)) for p in photos or []]
    lisibles = [(p, c) for p, c in lisibles if c]
    if not lisibles:
        return
    xml = contenus[slide].decode('utf-8')
    retirer = (legendes in ('aucune', 'chaque') if legendes
               else any('legende' in p for p, _ in lisibles))
    bande_commune = None
    m = re.search(r'<p:sp>(?:(?!</p:sp>).)*?name="' + LEGENDE_COMMUNE
                  + r'".*?</p:sp>', xml, re.S)
    if m and retirer:
        pos = RE_POSITION.search(m.group(0))
        if pos:
            bande_commune = tuple(int(v) for v in pos.groups())
            xml = xml[:m.start()] + xml[m.end():]
    trouves = emplacements(xml)
    if not trouves:
        return
    cadre_ = cadre([pos for _, pos in trouves] + ([bande_commune] if bande_commune else []))
    # Legende commune sans bande dans le modele : on la prend au bas du
    # cadre, sur toute sa largeur.
    legende_ajoutee = None
    if legendes == 'commune' and not m:
        x, y, l, h = cadre_
        cadre_ = (x, y, l, h - BANDE_LEGENDE - ECART_LEGENDE)
        if str(commune or '').strip():
            legende_ajoutee = (x, y + h - BANDE_LEGENDE, l, BANDE_LEGENDE)

    ident_forme = 900
    formes = []
    for i, (p, chemin) in enumerate(lisibles):
        rid = _joindre(contenus, slide, i + 1, chemin)
        pos = case(cadre_, p)
        if 'legende' in p:
            x, y, l, h = pos
            pos = (x, y, l, h - BANDE_LEGENDE)
            if str(p.get('legende') or '').strip():
                formes.append(forme_legende(
                    ident_forme + 50 + i, i + 1,
                    (x, y + h - BANDE_LEGENDE, l, BANDE_LEGENDE),
                    str(p['legende'])))
        with Image.open(chemin) as image:
            rect = rognage(image.width, image.height, pos[2], pos[3],
                           p.get('cadrage'))
        formes.append(forme_image(ident_forme + i, f'Photo {i + 1}', rid,
                                  pos, rect))
    if legende_ajoutee:
        formes.append(forme_legende(ident_forme + 99, 'ensemble', legende_ajoutee,
                                    str(commune)))

    # Les emplacements s'effacent, les photos prennent la place du premier.
    premier = trouves[0][0]
    for m, _ in reversed(trouves[1:]):
        xml = xml[:m.start()] + xml[m.end():]
    xml = xml[:premier.start()] + ''.join(formes) + xml[premier.end():]
    contenus[slide] = xml.encode('utf-8')


def poser_nommes(contenus, slide, par_nom, cache):
    """Pose chaque photo a la place de l'emplacement qui porte son nom.

    Pour les pages ou chaque image a un role — le portrait du formateur,
    la photo de groupe — plutot qu'une place dans une disposition.
    `par_nom` associe le nom de la forme a `{id, cadrage}`. L'image
    reprend exactement le cadre de l'emplacement, rognee pour le remplir.
    """
    xml = contenus[slide].decode('utf-8')
    rang = 0
    for nom, p in (par_nom or {}).items():
        chemin = _chemin((p or {}).get('id'), cache)
        if not chemin:
            continue
        m = re.search(r'<p:sp>(?:(?!</p:sp>).)*?name="' + re.escape(nom)
                      + r'".*?</p:sp>', xml, re.S)
        pos = m and RE_POSITION.search(m.group(0))
        if not pos:
            continue
        pos = tuple(int(v) for v in pos.groups())
        rang += 1
        rid = _joindre(contenus, slide, rang, chemin)
        with Image.open(chemin) as image:
            rect = rognage(image.width, image.height, pos[2], pos[3],
                           p.get('cadrage'))
        xml = (xml[:m.start()] + forme_image(900 + rang, nom, rid, pos, rect)
               + xml[m.end():])
    contenus[slide] = xml.encode('utf-8')


def _joindre(contenus, slide, rang, chemin):
    """Joint une image au paquet et a la diapositive ; renvoie sa relation."""
    base = Path(slide).stem
    media = f'ppt/media/{base}_photo{rang}.jpg'
    contenus[media] = chemin.read_bytes()
    rid = f'rIdPhoto{rang}'
    rels_nom = slide.replace('slides/', 'slides/_rels/') + '.rels'
    rels = contenus[rels_nom].decode('utf-8').replace(
        '</Relationships>',
        f'<Relationship Id="{rid}" Type="{TYPE_IMAGE}" '
        f'Target="../media/{Path(media).name}"/></Relationships>')
    contenus[rels_nom] = rels.encode('utf-8')

    types = contenus['[Content_Types].xml'].decode('utf-8')
    if 'Extension="jpg"' not in types:
        types = types.replace(
            '<Default ', '<Default Extension="jpg" ContentType="image/jpeg"/>'
            '<Default ', 1)
        contenus['[Content_Types].xml'] = types.encode('utf-8')
    return rid
