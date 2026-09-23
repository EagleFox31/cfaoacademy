# -*- coding: utf-8 -*-
"""Les classeurs Excel embarques des pages de resultats (17 et 19).

Le modele pose ses tableaux et graphiques de resultats comme des objets
OLE : un classeur Excel embarque, et une image EMF qui en montre l'etat.
PowerPoint comme LibreOffice affichent l'image ; le classeur ne sert
qu'au double-clic. Remplir le classeur ne suffit donc pas, il faut aussi
refaire l'image.

Pour chaque objet dont le classeur est reconnu :

  1. les cellules recoivent leurs valeurs, et les graphiques les memes
     valeurs dans leur cache — Excel les montre ainsi avant tout calcul ;
  2. une copie du classeur, reduite a la zone visible de l'objet, est
     convertie par LibreOffice puis rognee a son contenu ;
  3. cette image remplace l'EMF du modele.

Le classeur reste modifiable dans PowerPoint : un double-clic l'ouvre
avec les chiffres de la session, et Excel refait l'image a la sortie.

Un classeur se reconnait a son titre, en A1. Les valeurs arrivent
indexees par nature — `progression`, `acquisition`, `satisfaction` —
puis par cellule : `{'B2': 0.55, 'B3': 0.8}`.
"""
import hashlib
import io
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

NATURES = {
    'TAUX DE PROGRESSION': 'progression',
    # La fiche individuelle (diapositive 27) titre le sien « PROGRESSION ».
    'PROGRESSION': 'progression',
    'ACQUISITION DES COMPETENCES': 'acquisition',
    'QUALITÉ DE LA FORMATION': 'satisfaction',
}

RE_OLE = re.compile(r'<p:graphicFrame>(?:(?!</p:graphicFrame>).)*?<p:oleObj .*?'
                    r'</p:graphicFrame>', re.S)


def _lire(brut):
    with zipfile.ZipFile(io.BytesIO(brut)) as z:
        return {n: z.read(n) for n in z.namelist()}


def _ecrire(parts):
    tampon = io.BytesIO()
    with zipfile.ZipFile(tampon, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, d in parts.items():
            z.writestr(n, d)
    return tampon.getvalue()


def nature(parts):
    """La nature d'un classeur, d'apres le texte de sa cellule A1."""
    feuille = parts.get('xl/worksheets/sheet1.xml', b'').decode('utf-8')
    m = re.search(r'<c r="A1"([^>]*?)(?:/>|>(.*?)</c>)', feuille, re.S)
    if not m or not m.group(2):
        return None
    genre = re.search(r'\bt="(\w+)"', m.group(1))
    brut = re.search(r'<v>([^<]*)</v>|<t[^>]*>([^<]*)</t>', m.group(2))
    texte = (brut.group(1) or brut.group(2) or '') if brut else ''
    if genre and genre.group(1) == 's':
        partages = parts.get('xl/sharedStrings.xml', b'').decode('utf-8')
        chaines = [''.join(re.findall(r'<t[^>]*>([^<]*)</t>', si))
                   for si in re.findall(r'<si>(.*?)</si>', partages, re.S)]
        texte = chaines[int(texte)] if texte.isdigit() and int(texte) < len(chaines) else ''
    texte = texte.strip().upper()
    return next((n for t, n in NATURES.items() if texte.startswith(t)), None)


def _poser_cellule(feuille, ref, valeur):
    """La valeur d'une cellule, formule conservee."""
    v = f'<v>{float(valeur):.10g}</v>'
    motif = re.compile(r'<c r="' + ref + r'"([^>]*?)(/>|>(.*?)</c>)', re.S)
    m = motif.search(feuille)
    if not m:
        return feuille
    attributs = re.sub(r'\s+t="\w+"', '', m.group(1))
    formule = re.search(r'<f>.*?</f>|<f [^>]*/>|<f [^>]*>.*?</f>', m.group(3) or '', re.S)
    neuf = f'<c r="{ref}"{attributs}>{formule.group(0) if formule else ""}{v}</c>'
    return feuille[:m.start()] + neuf + feuille[m.end():]


def _plage(ref):
    """`Feuil1!$B$2:$B$4` -> ['B2', 'B3', 'B4'] (une ligne ou une colonne)."""
    m = re.search(r'\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$', ref)
    if not m:
        return []
    c1, l1 = m.group(1), int(m.group(2))
    c2, l2 = m.group(3) or c1, int(m.group(4) or l1)
    if c1 == c2:
        return [f'{c1}{l}' for l in range(l1, l2 + 1)]
    return [f'{chr(c)}{l1}' for c in range(ord(c1), ord(c2) + 1)]


def _cache(graphique, cellules):
    """Les caches numeriques des series, repris des cellules."""
    def sur_serie(m):
        cellules_serie = _plage(m.group(2))
        # Une valeur encore absente (notes ou questionnaires pas saisis)
        # laisse la serie telle que le modele la porte.
        if not cellules_serie or not all(cellules.get(c) is not None for c in cellules_serie):
            return m.group(0)
        points = ''.join(f'<c:pt idx="{i}"><c:v>{float(cellules[c]):.10g}</c:v></c:pt>'
                         for i, c in enumerate(cellules_serie))
        cache = re.sub(r'(<c:ptCount val="\d+"/>).*?(</c:numCache>)',
                       lambda k: k.group(1) + points + k.group(2),
                       m.group(3), count=1, flags=re.S)
        return m.group(1) + m.group(2) + '</c:f>' + cache
    return re.sub(r'(<c:numRef><c:f>)([^<]*)</c:f>(.*?</c:numRef>)', sur_serie,
                  graphique, flags=re.S)


def remplir_classeur(parts, cellules):
    """Les parties du classeur, cellules et caches de graphiques a jour."""
    parts = dict(parts)
    feuille = parts['xl/worksheets/sheet1.xml'].decode('utf-8')
    for ref, valeur in cellules.items():
        if valeur is not None:
            feuille = _poser_cellule(feuille, ref, valeur)
    parts['xl/worksheets/sheet1.xml'] = feuille.encode('utf-8')
    for nom in [n for n in parts if re.match(r'xl/charts/chart\d+\.xml$', n)]:
        parts[nom] = _cache(parts[nom].decode('utf-8'), cellules).encode('utf-8')
    return parts


# ── Signes + et = du graphique d'acquisition ────────────────────────────
# Le modele les a perdus (constate sur sa propre diapositive comme sur
# celle de tous les comptes rendus verifies), mais 98 classeurs du dossier
# compagnon les portent encore, sous deux formes distinctes :
#
#   * le « + », en forme utilisateur du graphique (`c:userShapes`),
#     positionnee en fraction du graphique lui-meme — elle suit le
#     graphique quel que soit son cadrage sur la diapositive ;
#   * le « = », en forme du dessin de la feuille (`xl/drawings/drawing1.xml`,
#     celui qui porte deja l'ancrage du graphique), positionnee en EMU
#     absolus sur la feuille.
#
# Les fractions ci-dessous viennent de la geometrie exacte d'un classeur
# source (le « + ») et d'une conversion EMU de son ancrage de cellules
# (le « = », les largeurs de colonnes different d'un fichier a l'autre) ;
# les deux ont ete recoupees avec la position en pixels mesuree sur
# l'image rendue du meme fichier, qui les confirme a moins de 0.1 pres.
SIGNES_ACQUISITION = {
    '+': dict(x0=0.33998, x1=0.43425, y0=0.65262, y1=0.80805, id_forme=2,
             nom='Signe Plus 1', nom_creation='8DE92517-B108-41BF-95A9-B83710DCFBEC'),
    '=': dict(x0=0.6535, x1=0.7365, y0=0.659, y1=0.721, id_forme=3,
             nom='Est égal à 2', nom_creation='5DD21F7B-8417-4D58-A2B9-C26DBC982262'),
}

_STYLE_FORME = (
    '<a:solidFill><a:schemeClr val="bg1"/></a:solidFill>'
    '<a:ln><a:solidFill><a:srgbClr val="003A70"/></a:solidFill></a:ln>')
# La reference de style (couleurs du theme) : sans elle, le moteur de
# rendu de LibreOffice laisse la forme invisible malgre un remplissage
# et un contour explicites.
_REF_STYLE = (
    '<a:lnRef idx="2"><a:schemeClr val="accent1"><a:shade val="50000"/></a:schemeClr></a:lnRef>'
    '<a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef>'
    '<a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef>'
    '<a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef>')
_LSTSTYLE_FORME = (
    '<a:lstStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr>'
    + ''.join(
        f'<a:lvl{n}pPr marL="{(n - 1) * 457200}" algn="l" defTabSz="914400" rtl="0" '
        'eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200">'
        '<a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:latin typeface="+mn-lt"/>'
        f'<a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl{n}pPr>'
        for n in range(1, 10))
    + '</a:lstStyle>')


def _userShapes_plus(prst, x0, x1, y0, y1, id_forme, nom, nom_creation, off_x, off_y):
    """Une forme du graphique (`c:userShapes`), en fraction de son cadre.

    `off_x`/`off_y` (EMU) alimentent le `xfrm` de la forme : un `<a:off>`
    a zero, correct pour la position reelle (donnee par le
    `relSizeAnchor`), a suffi a faire disparaitre la forme au rendu — le
    moteur de LibreOffice s'appuie visiblement aussi sur ce xfrm, meme
    quand `relSizeAnchor` prime dans PowerPoint.
    """
    return (
        '<c:userShapes xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" '
        'xmlns:cdr="http://schemas.openxmlformats.org/drawingml/2006/chartDrawing" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main">'
        '<cdr:relSizeAnchor>'
        f'<cdr:from><cdr:x>{x0}</cdr:x><cdr:y>{y0}</cdr:y></cdr:from>'
        f'<cdr:to><cdr:x>{x1}</cdr:x><cdr:y>{y1}</cdr:y></cdr:to>'
        f'<cdr:sp macro="" textlink=""><cdr:nvSpPr><cdr:cNvPr id="{id_forme}" name="{nom}">'
        '<a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}">'
        f'<a16:creationId id="{{{nom_creation}}}"/></a:ext></a:extLst>'
        '</cdr:cNvPr><cdr:cNvSpPr/></cdr:nvSpPr>'
        f'<cdr:spPr><a:xfrm><a:off x="{off_x}" y="{off_y}"/>'
        f'<a:ext cx="504000" cy="504000"/></a:xfrm>'
        f'<a:prstGeom prst="{prst}"><a:avLst/></a:prstGeom>'
        + _STYLE_FORME
        + '</cdr:spPr><cdr:style>' + _REF_STYLE + '</cdr:style>'
        + '<cdr:txBody><a:bodyPr rtlCol="0" anchor="ctr"/>'
        + _LSTSTYLE_FORME
        + '<a:p><a:pPr algn="ctr"/><a:endParaRPr lang="fr-FR"/></a:p></cdr:txBody></cdr:sp>'
          '</cdr:relSizeAnchor></c:userShapes>'
    )


def _drawing_egal(x, y, prst='mathEqual', id_forme=3, nom='Est égal à 2',
                  nom_creation='5DD21F7B-8417-4D58-A2B9-C26DBC982262'):
    """La forme « = », en EMU absolus sur la feuille (`xdr:absoluteAnchor`).

    Une ancre absolue evite l'ecueil d'une ancre a une cellule dont le
    decalage depasserait la largeur de la colonne (comportement indefini
    en dehors d'Excel) : la position ne depend d'aucune largeur de
    colonne ni hauteur de ligne, differentes d'un classeur a l'autre.
    """
    return (
        '<xdr:absoluteAnchor>'
        f'<xdr:pos x="{x}" y="{y}"/>'
        '<xdr:ext cx="504000" cy="504000"/>'
        f'<xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="{id_forme}" name="{nom}">'
        '<a:extLst><a:ext uri="{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}">'
        '<a16:creationId xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main" '
        f'id="{{{nom_creation}}}"/></a:ext></a:extLst></xdr:cNvPr><xdr:cNvSpPr/></xdr:nvSpPr>'
        f'<xdr:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="504000" cy="504000"/></a:xfrm>'
        f'<a:prstGeom prst="{prst}"><a:avLst/></a:prstGeom>' + _STYLE_FORME
        + '</xdr:spPr><xdr:style>' + _REF_STYLE + '</xdr:style>'
        + '<xdr:txBody><a:bodyPr wrap="square" rtlCol="0" anchor="ctr"/>'
        + _LSTSTYLE_FORME
        + '<a:p><a:pPr algn="ctr"/><a:endParaRPr lang="fr-CM">'
          '<a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:endParaRPr></a:p>'
          '</xdr:txBody></xdr:sp><xdr:clientData/></xdr:absoluteAnchor>'
    )


def _hauteur_lignes(parts, jusqua):
    """La hauteur cumulee (EMU) des lignes 0 a `jusqua` exclue.

    Chaque ligne vaut sa hauteur explicite (`ht`, en points) ou la
    hauteur par defaut de la feuille — 1 point = 12700 EMU.
    """
    feuille = parts['xl/worksheets/sheet1.xml'].decode('utf-8')
    defaut = re.search(r'defaultRowHeight="([\d.]+)"', feuille)
    defaut = float(defaut.group(1)) if defaut else 15.0
    hauteurs = {int(r): float(h) for r, h in
               re.findall(r'<row r="(\d+)"[^>]*\bht="([\d.]+)"', feuille)}
    return round(sum(hauteurs.get(r + 1, defaut) for r in range(jusqua)) * 12700)


def _largeur_colonnes(parts, jusqua):
    """La largeur cumulee (EMU) des colonnes 0 a `jusqua` exclue.

    La largeur Excel (en « caracteres ») se convertit en pixels par la
    formule usuelle (police par defaut Calibri 11, chiffre repere 7 px),
    puis en EMU a 96 ppp.
    """
    feuille = parts['xl/worksheets/sheet1.xml'].decode('utf-8')
    defaut = re.search(r'defaultColWidth="([\d.]+)"', feuille)
    defaut = float(defaut.group(1)) if defaut else 8.43
    largeurs = {}
    for mn, mx, w in re.findall(r'<col min="(\d+)" max="(\d+)"[^>]*width="([\d.]+)"', feuille):
        for col in range(int(mn), int(mx) + 1):
            largeurs[col] = float(w)
    px = lambda l: int(l * 7 + 5)
    return sum(px(largeurs.get(c + 1, defaut)) * 9525 for c in range(jusqua))


def _point_feuille(parts, col, col_off, ligne, ligne_off):
    """La position (x, y) en EMU absolus sur la feuille d'une ancre de cellule."""
    return (_largeur_colonnes(parts, col) + col_off,
            _hauteur_lignes(parts, ligne) + ligne_off)


def _cadre_graphique(parts, d1):
    """Le rectangle du graphique en EMU absolus sur la feuille.

    Lu sur son propre ancrage (`xdr:from`/`xdr:to` du `twoCellAnchor` qui
    porte le graphique) : c'est la seule mesure fiable de sa taille sur
    la feuille — celle de l'objet OLE sur la diapositive (`imgW`/`imgH`)
    reflete un cadrage qui peut differer.
    """
    ancre = re.search(
        r'<xdr:from><xdr:col>(\d+)</xdr:col><xdr:colOff>(\d+)</xdr:colOff>'
        r'<xdr:row>(\d+)</xdr:row><xdr:rowOff>(\d+)</xdr:rowOff></xdr:from>'
        r'<xdr:to><xdr:col>(\d+)</xdr:col><xdr:colOff>(\d+)</xdr:colOff>'
        r'<xdr:row>(\d+)</xdr:row><xdr:rowOff>(\d+)</xdr:rowOff></xdr:to>', d1)
    if not ancre:
        return (0, 0, 0, 0)
    c1, co1, r1, ro1, c2, co2, r2, ro2 = (int(g) for g in ancre.groups())
    x0, y0 = _point_feuille(parts, c1, co1, r1, ro1)
    x1, y1 = _point_feuille(parts, c2, co2, r2, ro2)
    return x0, y0, x1 - x0, y1 - y0


def _ajouter_signes_acquisition(parts):
    """Ajoute les signes + et = manquants au graphique d'acquisition.

    Les deux signes se positionnent en fraction du cadre du graphique,
    mesure sur la feuille elle-meme (`_cadre_graphique`) — pas sur la
    taille de l'objet OLE affichee sur la diapositive (`imgW`/`imgH`),
    qui peut differer selon le cadrage retenu.
    """
    parts = dict(parts)
    chart_nom = next((n for n in parts if re.match(r'xl/charts/chart\d+\.xml$', n)), None)
    if not chart_nom:
        return parts  # pas de graphique a completer
    graphique = parts[chart_nom].decode('utf-8')
    # Un `c:userShapes` deja en place, non vide, porte deja des formes —
    # certains classeurs du modele en gardent un coquille vide (la forme
    # d'origine a disparu sans que la reference ne suive), qu'on remplit
    # plutot que de le laisser inerte.
    ref_existante = re.search(r'<c:userShapes r:id="([^"]+)"/>', graphique)
    if ref_existante:
        rels_nom = chart_nom.replace('charts/', 'charts/_rels/') + '.rels'
        cible = re.search(r'Id="' + re.escape(ref_existante.group(1))
                          + r'"[^>]*Target="([^"]+)"', parts[rels_nom].decode('utf-8'))
        drawing_existant = ('xl/' + cible.group(1).replace('../', '')) if cible else None
        if drawing_existant and parts.get(drawing_existant, b'').strip().endswith(
                b'</c:userShapes>') and b'<cdr:' in parts.get(drawing_existant, b''):
            return parts  # deja rempli, rien a faire

    d1_nom = 'xl/drawings/drawing1.xml'
    cx, cy, cl, ch = _cadre_graphique(parts, parts[d1_nom].decode('utf-8'))

    plus = SIGNES_ACQUISITION['+']
    contenu_drawing = _userShapes_plus(
        'mathPlus', plus['x0'], plus['x1'], plus['y0'], plus['y1'],
        plus['id_forme'], plus['nom'], plus['nom_creation'],
        cx + round(plus['x0'] * cl), cy + round(plus['y0'] * ch))

    if ref_existante and drawing_existant:
        # La reference et la relation existent deja : on ne fait que
        # remplacer le contenu de la forme utilisateur, vide ou perimee.
        parts[drawing_existant] = contenu_drawing.encode('utf-8')
    else:
        num = 2
        while f'xl/drawings/drawing{num}.xml' in parts:
            num += 1
        nom_drawing = f'xl/drawings/drawing{num}.xml'
        parts[nom_drawing] = contenu_drawing.encode('utf-8')

        rid = 'rIdSignes'
        graphique = graphique.replace(
            '</c:printSettings>', f'</c:printSettings><c:userShapes r:id="{rid}"/>', 1)
        if '<c:userShapes r:id=' not in graphique:
            graphique = graphique.replace('</c:chartSpace>',
                                          f'<c:userShapes r:id="{rid}"/></c:chartSpace>', 1)
        parts[chart_nom] = graphique.encode('utf-8')

        rels_nom = chart_nom.replace('charts/', 'charts/_rels/') + '.rels'
        rels = parts.get(rels_nom, b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                        b'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006'
                        b'/relationships"></Relationships>').decode('utf-8')
        rels = rels.replace('</Relationships>',
                            f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org'
                            f'/officeDocument/2006/relationships/chartUserShapes" '
                            f'Target="../drawings/drawing{num}.xml"/></Relationships>')
        parts[rels_nom] = rels.encode('utf-8')

        types = parts['[Content_Types].xml'].decode('utf-8')
        if f'/xl/drawings/drawing{num}.xml' not in types:
            types = types.replace('</Types>',
                                  f'<Override PartName="/xl/drawings/drawing{num}.xml" '
                                  'ContentType="application/vnd.openxmlformats-officedocument.'
                                  'drawingml.chartshapes+xml"/></Types>')
        parts['[Content_Types].xml'] = types.encode('utf-8')

    # Le « = », sur le dessin de la feuille qui porte deja l'ancrage du
    # graphique : sa position EMU absolue se lit sur le meme cadre,
    # a laquelle on applique la fraction verifiee (voir SIGNES_ACQUISITION).
    egal = SIGNES_ACQUISITION['=']
    x = cx + round(egal['x0'] * cl)
    y = cy + round(egal['y0'] * ch)
    forme_egal = _drawing_egal(x, y, 'mathEqual', egal['id_forme'], egal['nom'],
                               egal['nom_creation'])
    d1 = parts[d1_nom].decode('utf-8')
    parts[d1_nom] = d1.replace('</xdr:wsDr>', forme_egal + '</xdr:wsDr>').encode('utf-8')
    return parts


def _pour_rendu(parts):
    """Une copie a imprimer : la zone visible de l'objet, sur une page."""
    parts = dict(parts)
    classeur = parts['xl/workbook.xml'].decode('utf-8')
    zone = re.search(r'<oleSize ref="([^"]+)"', classeur)
    if zone:
        a, _, b = zone.group(1).partition(':')
        absolu = lambda r: re.sub(r'([A-Z]+)(\d+)', r'$\1$\2', r)
        nom = re.search(r'<sheet [^>]*name="([^"]+)"', classeur).group(1)
        defini = (f'<definedName name="_xlnm.Print_Area" localSheetId="0">'
                  f"'{nom}'!{absolu(a)}:{absolu(b or a)}</definedName>")
        if '<definedNames>' in classeur:
            classeur = classeur.replace('<definedNames>', '<definedNames>' + defini, 1)
        else:
            classeur = classeur.replace('</sheets>', '</sheets><definedNames>'
                                        + defini + '</definedNames>', 1)
    parts['xl/workbook.xml'] = classeur.encode('utf-8')
    feuille = parts['xl/worksheets/sheet1.xml'].decode('utf-8')
    if '<sheetPr' not in feuille:
        feuille = re.sub(r'(<worksheet[^>]*>)',
                         r'\1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>', feuille, count=1)
    feuille = re.sub(r'<pageSetup [^>]*/>',
                     '<pageSetup paperSize="9" orientation="landscape" '
                     'fitToWidth="1" fitToHeight="1"/>', feuille, count=1)
    parts['xl/worksheets/sheet1.xml'] = feuille.encode('utf-8')
    # Les etiquettes d'un anneau sont decalees depuis le milieu de leur
    # secteur : le modele les loge dans le trou de l'anneau quand les
    # valeurs sont nulles. Avec de vraies valeurs, et le trou plus petit
    # que LibreOffice dessine, elles chevauchent l'anneau. Le rendu les
    # retire ; une legende les remplace (`_legende_anneau`).
    for nom in [n for n in parts if re.match(r'xl/charts/chart\d+\.xml$', n)]:
        graphique = parts[nom].decode('utf-8')
        if '<c:doughnutChart>' in graphique:
            graphique = re.sub(r'<c:dLbls>.*?</c:dLbls>',
                               '<c:dLbls><c:delete val="1"/></c:dLbls>', graphique, flags=re.S)
            parts[nom] = graphique.encode('utf-8')
    return parts


# La legende d'un anneau : la couleur de chaque serie et son libelle,
# la valeur lue dans sa cellule.
LEGENDES = {
    'satisfaction': [((0, 32, 96), 'Qualité de la formation', 'B9'),
                     ((255, 192, 0), 'Qualité de l’accueil', 'B18')],
}


def _legende_anneau(image, entrees, cellules):
    """Pose sous l'anneau une legende : pastille, libelle et valeur."""
    from PIL import ImageDraw, ImageFont
    l, h = image.size
    pixels = image.load()
    couleurs = [c for c, _, _ in entrees]

    def colore(x, y):
        r, g, b, a = pixels[x, y]
        return a and any(abs(r - c[0]) + abs(g - c[1]) + abs(b - c[2]) < 60
                         for c in couleurs)

    # L'anneau est le bloc colore le plus bas, et le plus a droite : le
    # tableau, qui porte les memes couleurs, est a sa gauche (page 19) ou
    # au-dessus (fiche individuelle).
    rangs = [y for y in range(0, h, 3) if any(colore(x, y) for x in range(l // 2, l, 3))]
    if not rangs:
        return image
    bas = haut = rangs[-1]
    for y in reversed(rangs):
        if haut - y > 12:
            break
        haut = y
    colonnes = [x for x in range(0, l, 3)
                if any(colore(x, y) for y in range(haut, bas + 1, 3))]
    droite = gauche = colonnes[-1]
    for x in reversed(colonnes):
        if gauche - x > 12:
            break
        gauche = x
    # Le corps suit la taille de l'anneau, et la legende tient dans l'image.
    taille = max(12, min(round(h * 0.045), round((droite - gauche) * 0.065)))

    def police_de(t):
        try:
            return ImageFont.truetype('calibrib.ttf', t)
        except OSError:
            return ImageFont.load_default()

    lignes = []
    for couleur, libelle, ref in entrees:
        v = cellules.get(ref)
        # Arrondi a l'unite superieure des 0,5, comme le format « 0 % »
        # d'Excel : le tableau voisin et la legende disent le meme chiffre.
        lignes.append((couleur, f'{libelle} : {int(float(v) * 100 + 0.5)} %'
                       if v is not None else libelle))
    mesure = ImageDraw.Draw(image)
    while True:
        police = police_de(taille)
        largeur = max(mesure.textlength(t, font=police) for _, t in lignes) + taille * 1.4
        if largeur <= l or taille <= 10:
            break
        taille -= 1
    pas = round(taille * 1.5)
    besoin = bas + round(taille * 0.8) + pas * len(lignes)
    if besoin > h:
        from PIL import Image
        agrandie = Image.new('RGBA', (l, besoin), (255, 255, 255, 0))
        agrandie.paste(image, (0, 0))
        image = agrandie
    dessin = ImageDraw.Draw(image)
    x0 = min(max(0, round((gauche + droite) / 2 - largeur / 2)), max(0, round(l - largeur)))
    y = bas + round(taille * 0.8)
    for couleur, texte in lignes:
        dessin.rectangle([x0, y + taille * 0.2, x0 + taille * 0.8, y + taille],
                         fill=couleur + (255,))
        dessin.text((x0 + taille * 1.4, y), texte, font=police, fill=(0, 0, 0, 255))
        y += pas
    return image


def _rogner(pixmap_png, legende=None, cellules=None, ratio=None):
    """L'image rognee a son contenu, le blanc rendu transparent.

    L'EMF du modele n'a pas de fond : pose sur la moitie grise de la
    page, le tableau prend la couleur de la page. Le blanc du rendu
    devient donc transparent.
    """
    from PIL import Image, ImageChops
    image = Image.open(io.BytesIO(pixmap_png)).convert('RGB')
    blanc = None
    for canal in image.split():
        clair = canal.point(lambda v: 255 if v >= 248 else 0)
        blanc = clair if blanc is None else ImageChops.multiply(blanc, clair)
    image.putalpha(ImageChops.invert(blanc))
    boite = image.getbbox()
    if boite:
        image = image.crop(boite)
    if legende:
        image = _legende_anneau(image, legende, cellules or {})
    # L'objet etire son image aux proportions de l'EMF d'origine : on les
    # retrouve par un bord transparent, centre sur les deux axes pour ne
    # pas laisser le contenu glisser vers un coin de son cadre.
    if ratio:
        from PIL import Image
        l, h = image.size
        cible_l, cible_h = max(l, round(h * ratio)), max(h, round(l / ratio))
        if (cible_l, cible_h) != (l, h):
            cadre = Image.new('RGBA', (cible_l, cible_h), (255, 255, 255, 0))
            cadre.paste(image, ((cible_l - l) // 2, (cible_h - h) // 2))
            image = cadre
    sortie = io.BytesIO()
    image.save(sortie, 'PNG', optimize=True)
    return sortie.getvalue()


def rendre(classeurs_bruts, soffice, profil, cache, legendes=None):
    """Les images des classeurs, depuis le cache ou fraichement rendues.

    Tous les classeurs a rendre passent dans un seul appel a LibreOffice :
    c'est son lancement qui coute.
    """
    import fitz
    dossier = Path(cache) / 'classeurs'
    dossier.mkdir(parents=True, exist_ok=True)
    images, a_faire = {}, {}
    for cle, brut in classeurs_bruts.items():
        empreinte = hashlib.sha1(brut).hexdigest()[:16]
        chemin = dossier / f'{empreinte}.png'
        if chemin.exists():
            images[cle] = chemin.read_bytes()
        else:
            a_faire[cle] = (empreinte, brut)
    if a_faire:
        travail = Path(tempfile.mkdtemp(prefix='cr-classeurs-'))
        for empreinte, brut in a_faire.values():
            copie = _ecrire(_pour_rendu(_lire(brut)))
            (travail / f'{empreinte}.xlsx').write_bytes(copie)
        subprocess.run(
            [soffice, '--headless', '--norestore', f'-env:UserInstallation={profil}',
             '--convert-to', 'pdf', '--outdir', str(travail)]
            + [str(travail / f'{e}.xlsx') for e, _ in a_faire.values()],
            capture_output=True, timeout=120)
        for cle, (empreinte, _) in a_faire.items():
            pdf = travail / f'{empreinte}.pdf'
            if not pdf.exists():
                continue
            with fitz.open(pdf) as doc:
                png = doc[0].get_pixmap(dpi=200).tobytes('png')
            quoi, cellules, ratio = (legendes or {}).get(cle, (None, None, None))
            image = _rogner(png, LEGENDES.get(quoi), cellules, ratio)
            (dossier / f'{empreinte}.png').write_bytes(image)
            images[cle] = image
    return images


def rafraichir(contenus, slides, valeurs, soffice, profil, cache):
    """Remplit les classeurs des diapositives `slides` et refait leur image.

    `valeurs` : `{nature: {cellule: valeur}}`. Un classeur dont la nature
    n'a pas de valeurs garde son etat du modele.
    """
    if not valeurs:
        return
    types = contenus['[Content_Types].xml'].decode('utf-8')
    a_rendre, poses, natures = {}, [], {}
    for slide in slides:
        rels_nom = slide.replace('slides/', 'slides/_rels/') + '.rels'
        if slide not in contenus or rels_nom not in contenus:
            continue
        xml = contenus[slide].decode('utf-8')
        rels = contenus[rels_nom].decode('utf-8')
        cibles = dict(re.findall(r'Id="([^"]+)"[^>]*?Target="([^"]+)"', rels))
        for m in RE_OLE.finditer(xml):
            objet = re.search(r'<p:oleObj [^>]*r:id="([^"]+)"', m.group(0))
            images = set(re.findall(r'<a:blip r:embed="([^"]+)"', m.group(0)))
            if not objet or not images or objet.group(1) not in cibles:
                continue
            emb = 'ppt/' + cibles[objet.group(1)].replace('../', '')
            if emb not in contenus:
                continue
            parts = _lire(contenus[emb])
            quoi = nature(parts)
            if quoi not in valeurs:
                continue
            remplies = remplir_classeur(parts, valeurs[quoi])
            if quoi == 'acquisition':
                remplies = _ajouter_signes_acquisition(remplies)
            brut = _ecrire(remplies)
            contenus[emb] = brut
            a_rendre[emb] = brut
            # L'image s'etire aux proportions du cadre de l'objet, qui ne
            # sont pas toujours celles de l'EMF (page 27) : c'est sur le
            # cadre qu'on les prend, sinon l'anneau devient ovale.
            taille = (re.search(r'<a:ext cx="(\d+)" cy="(\d+)"', m.group(0))
                      or re.search(r'imgW="(\d+)" imgH="(\d+)"', m.group(0)))
            ratio = int(taille.group(1)) / int(taille.group(2)) if taille else None
            natures[emb] = (quoi, valeurs[quoi], ratio)
            poses += [(rels_nom, rid, emb) for rid in images]
    if not a_rendre:
        return
    rendus = rendre(a_rendre, soffice, profil, cache, natures)
    for rels_nom, rid, emb in poses:
        if emb not in rendus:
            continue
        media = f'ppt/media/{Path(emb).stem}_apercu.png'
        contenus[media] = rendus[emb]
        rels = contenus[rels_nom].decode('utf-8')
        rels = re.sub(r'(<Relationship [^>]*Id="' + re.escape(rid) + r'"[^>]*Target=")[^"]+"',
                      lambda k: k.group(1) + f'../media/{Path(media).name}"', rels)
        contenus[rels_nom] = rels.encode('utf-8')
    if 'Extension="png"' not in types:
        types = types.replace('<Default ', '<Default Extension="png" '
                              'ContentType="image/png"/><Default ', 1)
        contenus['[Content_Types].xml'] = types.encode('utf-8')
