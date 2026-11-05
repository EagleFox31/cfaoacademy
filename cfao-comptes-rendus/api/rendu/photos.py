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

import mise_en_page

# Le plus grand cote conserve : assez pour une case pleine largeur
# imprimee, sans garder la definition d'un capteur de telephone.
COTE_MAX = 1600
QUALITE = 85

# L'espace entre deux photos, celui que le modele laisse entre ses deux
# emplacements de la diapositive 9.
ECART = 125000

# La bande de legende sous une photo, celle des diapositives 12 a 15 :
# la hauteur minimale, une legende de deux lignes l'agrandit.
BANDE_LEGENDE = 329184
# Entre les photos et une legende commune ajoutee : la moitie d'un ecart.
ECART_LEGENDE = ECART // 2
# Le corps des legendes, en centiemes de point, le meme dans tout le
# rapport : une longue legende prend une ligne de plus, et ne descend
# au minimum que pour tenir sur trois lignes.
CORPS_LEGENDE = 1100
CORPS_LEGENDE_MIN = 1000
CORPS_COMMUNE = 1200
LIGNES_LEGENDE = 3

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


def mesure_legende(texte, largeur, corps, corps_min=None):
    """Le corps et la hauteur de bande d'une legende dans `largeur`.

    Le corps diminue jusqu'a `corps_min` tant que la legende depasse
    `LIGNES_LEGENDE` lignes ; la bande grandit avec le nombre de lignes.
    """
    corps_min = corps_min or corps
    while True:
        # Un peu de largeur en reserve : la police de remplacement des
        # apercus est plus large que celle de PowerPoint.
        n = mise_en_page.lignes_texte(texte, largeur * 0.9, corps)
        if n <= LIGNES_LEGENDE or corps <= corps_min:
            break
        corps -= 100
    hauteur = round(n * mise_en_page.hauteur_ligne(corps)) + 2 * ECART_LEGENDE
    return corps, max(BANDE_LEGENDE, hauteur)


def forme_legende(ident_forme, rang, pos, texte, corps=CORPS_LEGENDE):
    """La legende d'une photo, dans le style des diapositives 12 a 15."""
    x, y, l, h = pos
    return (
        f'<p:sp><p:nvSpPr><p:cNvPr id="{ident_forme}" name="Legende {rang}"/>'
        '<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>'
        f'<a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{l}" cy="{h}"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>'
        '<p:txBody><a:bodyPr wrap="square" lIns="0" rIns="0" tIns="0" bIns="0" '
        'rtlCol="0" anchor="ctr"><a:normAutofit/></a:bodyPr><a:lstStyle/>'
        f'<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="fr-FR" sz="{corps}" dirty="0">'
        '<a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:rPr>'
        f'<a:t>{html.escape(texte, quote=False)}</a:t></a:r></a:p></p:txBody></p:sp>')


def caler_commune(forme):
    """La bande « Legende ensemble » du modele, a la mesure de son texte.

    Le texte prend un corps fixe ; la bande grandit vers le haut s'il
    faut une seconde ligne et ne descend pas sous la limite des logos.
    Renvoie la forme et le haut de la bande, que les photos ne passent
    pas.
    """
    pos = RE_POSITION.search(forme)
    texte = html.unescape(''.join(re.findall(r'<a:t>([^<]*)</a:t>', forme))).strip()
    if not pos or not texte:
        return forme, None
    x, y, l, h = (int(v) for v in pos.groups())
    body = re.search(r'<a:bodyPr\b[^>]*', forme)
    marges = sum(int(v) for v in re.findall(r'\b[lr]Ins="(\d+)"', body.group(0))) \
        if body and re.search(r'\b[lr]Ins=', body.group(0)) else 2 * 91440
    corps, bande = mesure_legende(texte, l - marges, CORPS_COMMUNE)
    bas = min(y + h, mise_en_page.LIMITE_BAS)
    haut = bas - max(h, bande)
    forme = RE_POSITION.sub(f'<a:off x="{x}" y="{haut}"/><a:ext cx="{l}" cy="{bas - haut}"/>',
                            forme, count=1)

    def taille(m):
        balise = re.sub(r'\ssz="\d+"', '', m.group(0))
        return balise.replace(m.group(1), f'{m.group(1)} sz="{corps}"', 1)
    forme = re.sub(r'(<a:(?:rPr|endParaRPr))\b[^>]*?(?=/?>)', taille, forme)
    return forme, haut


def disposer(cadre_, liste):
    """Les cases des photos et les legendes qui les accompagnent.

    Seule une rangee dont une photo au moins a une legende ecrite garde
    une bande : une legende vide ne laisse plus de blanc. Deux photos
    voisines de la meme rangee qui disent la meme chose partagent une
    seule legende, sur leurs deux largeurs. Une legende sur toute la
    largeur du cadre prend le corps de la legende commune, une autre
    celui des diapositives 12 a 15 ; les legendes d'une meme largeur
    partagent le corps de la page, et la bande d'une rangee prend la
    hauteur de sa plus longue legende.

    Quand les rangees se suivent sans se chevaucher (photos cote a cote,
    ou l'une sous l'autre), la hauteur rendue par une rangee sans legende
    est repartie entre toutes les photos ; sinon chaque case cede
    simplement sa bande. Renvoie les cases et `[(pos, texte, corps, rang)]`.
    """
    x0, y0, l0, h0 = cadre_
    cases = [case(cadre_, p) for p in liste]
    if not any('legende' in p for p in liste):
        return cases, []

    def cle(p):
        return round(float(p.get('y', 0)), 3), round(float(p.get('h', 1)), 3)

    def largeur(ids):
        return cases[ids[-1]][0] + cases[ids[-1]][2] - cases[ids[0]][0]

    rangs = sorted({cle(p) for p in liste})
    groupes = {}
    for r in rangs:
        ordre = sorted((i for i, p in enumerate(liste) if cle(p) == r),
                       key=lambda i: cases[i][0])
        suite = []
        for i in ordre:
            texte = str(liste[i].get('legende') or '').strip()
            voisin = suite and suite[-1][1] == texte and abs(
                cases[suite[-1][0][-1]][0] + cases[suite[-1][0][-1]][2] + ECART - cases[i][0]) <= 2
            if texte and voisin:
                suite[-1][0].append(i)
            else:
                suite.append(([i], texte))
        groupes[r] = [(ids, texte) for ids, texte in suite if texte]

    def depart(ids):
        # Pleine largeur : le corps de la legende commune.
        return CORPS_COMMUNE if largeur(ids) >= l0 * 0.95 else CORPS_LEGENDE

    ecrites = [(ids, texte) for g in groupes.values() for ids, texte in g]
    corps_de = {}
    for ids, texte in ecrites:
        mesure = mesure_legende(texte, largeur(ids), depart(ids), CORPS_LEGENDE_MIN)[0]
        corps_de[depart(ids)] = min(corps_de.get(depart(ids), mesure), mesure)

    def corps(ids):
        return corps_de[depart(ids)]

    bandes = {r: max((mesure_legende(texte, largeur(ids), corps(ids))[1] for ids, texte in g),
                     default=0) for r, g in groupes.items()}

    if all(a[0] + a[1] <= b[0] + 0.001 for a, b in zip(rangs, rangs[1:])):
        total = sum(r[1] for r in rangs) or 1
        hauteur = h0 - sum(bandes.values()) - ECART * (len(rangs) - 1)
        lignes, haut = {}, y0
        for r in rangs:
            h = round(hauteur * r[1] / total)
            lignes[r] = (haut, h)
            haut += h + bandes[r] + ECART
        cases = [(c[0], lignes[cle(p)][0], c[2], lignes[cle(p)][1])
                 for c, p in zip(cases, liste)]
    else:
        cases = [(c[0], c[1], c[2], c[3] - bandes[cle(p)]) for c, p in zip(cases, liste)]

    poses = []
    for r, g in groupes.items():
        for ids, texte in g:
            c = cases[ids[0]]
            poses.append(((c[0], c[1] + c[3], largeur(ids), bandes[r]), texte, corps(ids), ids[0]))
    return cases, poses


def poser(contenus, slide, photos, cache, legendes=None, commune=''):
    """Pose les photos dans la diapositive `slide` du paquet `contenus`.

    `photos` est la liste des `{id, x, y, l, h}` de la disposition, dans
    l'ordre du formateur, avec au besoin son `cadrage` et sa `legende`.
    Une photo qui porte une cle `legende` peut ceder le bas de sa case a
    une bande de legende (voir `disposer`).

    `legendes` dit ou vont les legendes, choisies a part de la
    disposition : `aucune` (les photos prennent tout le cadre), `chaque`
    (une bande par photo) ou `commune` (une bande sous l'ensemble, qui
    porte `commune`). La page jour a deja sa bande commune, « Legende
    ensemble », remplie par son drapeau : elle ne reste qu'en mode
    `commune`, et rejoint le cadre des photos sinon. Les autres pages
    n'en ont pas : le mode `commune` la cree au bas du cadre. Sans mode
    (ancien appel), seule une photo legendee retire la bande commune.

    Rien ne descend sous `mise_en_page.LIMITE_BAS`, au-dessus des logos.

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
    haut_commune = None
    m = re.search(r'<p:sp>(?:(?!</p:sp>).)*?name="' + LEGENDE_COMMUNE
                  + r'".*?</p:sp>', xml, re.S)
    if m and retirer:
        pos = RE_POSITION.search(m.group(0))
        if pos:
            bande_commune = tuple(int(v) for v in pos.groups())
            xml = xml[:m.start()] + xml[m.end():]
    elif m:
        forme, haut_commune = caler_commune(m.group(0))
        xml = xml[:m.start()] + forme + xml[m.end():]
    trouves = emplacements(xml)
    if not trouves:
        return
    x0, y0, l0, h0 = cadre([pos for _, pos in trouves] + ([bande_commune] if bande_commune else []))
    h0 = min(h0, mise_en_page.LIMITE_BAS - y0)
    if haut_commune is not None:
        h0 = min(h0, haut_commune - ECART_LEGENDE - y0)
    # Legende commune sans bande dans le modele : on la prend au bas du
    # cadre, sur toute sa largeur.
    legende_ajoutee = None
    commune = str(commune or '').strip()
    if legendes == 'commune' and not m and commune:
        corps, bande = mesure_legende(commune, l0, CORPS_COMMUNE)
        h0 -= bande + ECART_LEGENDE
        legende_ajoutee = ((x0, y0 + h0 + ECART_LEGENDE, l0, bande), corps)

    cases, poses = disposer((x0, y0, l0, h0), [p for p, _ in lisibles])
    ident_forme = 900
    formes = []
    for i, ((p, chemin), pos) in enumerate(zip(lisibles, cases)):
        rid = _joindre(contenus, slide, i + 1, chemin)
        with Image.open(chemin) as image:
            rect = rognage(image.width, image.height, pos[2], pos[3],
                           p.get('cadrage'))
        formes.append(forme_image(ident_forme + i, f'Photo {i + 1}', rid,
                                  pos, rect))
    for pos, texte, corps, i in poses:
        formes.append(forme_legende(ident_forme + 50 + i, i + 1, pos, texte, corps))
    if legende_ajoutee:
        pos, corps = legende_ajoutee
        formes.append(forme_legende(ident_forme + 99, 'ensemble', pos, commune, corps))

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
    Avec `cote: 'droite'`, la forme reste et se retrecit : la photo,
    carree et de sa hauteur, se pose a sa droite (la photo du stagiaire
    a cote de son appreciation).
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
        garde = ''
        if p.get('cote') == 'droite':
            x, y, l, h = pos
            garde = m.group(0).replace(
                f'<a:ext cx="{l}" cy="{h}"/>', f'<a:ext cx="{l - h - ECART}" cy="{h}"/>', 1)
            pos = (x + l - h, y, h, h)
        with Image.open(chemin) as image:
            rect = rognage(image.width, image.height, pos[2], pos[3],
                           p.get('cadrage'))
        xml = (xml[:m.start()] + garde + forme_image(900 + rang, nom, rid, pos, rect)
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
