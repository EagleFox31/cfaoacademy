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
import html
import io
import math
import re
import shutil
import subprocess
import tempfile
import threading
import zipfile
from pathlib import Path

# LibreOffice n'accepte qu'un processus par profil : deux conversions
# lancees en meme temps (deux formateurs sur le reseau) font echouer la
# seconde. Toutes les conversions du service passent par ce verrou.
LIBREOFFICE = threading.Lock()

NATURES = {
    'TAUX DE PROGRESSION': 'progression',
    # La fiche individuelle (diapositive 27) titre le sien « PROGRESSION ».
    'PROGRESSION': 'progression',
    'ACQUISITION DES COMPETENCES': 'acquisition',
    'QUALITÉ DE LA FORMATION': 'satisfaction',
    "QUALITÉ DE L'ACCUEIL": 'satisfaction',
}

RE_OLE = re.compile(r'<p:graphicFrame>(?:(?!</p:graphicFrame>).)*?<p:oleObj .*?'
                    r'</p:graphicFrame>', re.S)


def _lire(brut):
    with zipfile.ZipFile(io.BytesIO(brut)) as z:
        return {n: z.read(n) for n in z.namelist()}


def _ecrire(parts):
    # Date fixe : a contenu egal, octets egaux, sinon l'empreinte du
    # cache d'images change a chaque seconde et le cache ne sert jamais.
    tampon = io.BytesIO()
    with zipfile.ZipFile(tampon, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, d in parts.items():
            z.writestr(zipfile.ZipInfo(n, (1980, 1, 1, 0, 0, 0)), d, zipfile.ZIP_DEFLATED)
    return tampon.getvalue()


def nature(parts):
    """La nature d'un classeur, d'apres le texte de sa cellule A1.

    Sans note de formation, le classeur de satisfaction a perdu son A1 :
    le titre de l'accueil (A11) le fait reconnaitre.
    """
    feuille = parts.get('xl/worksheets/sheet1.xml', b'').decode('utf-8')
    trouvee = _nature_de(parts, feuille, 'A1')
    if trouvee is None and _nature_de(parts, feuille, 'A11') == 'satisfaction':
        return 'satisfaction'
    return trouvee


def _nature_de(parts, feuille, ref):
    m = re.search(rf'<c r="{ref}"([^>]*?)(?:/>|>(.*?)</c>)', feuille, re.S)
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


def _poser_tiret(feuille, ref):
    """Un tiret a la place d'une valeur absente : questionnaire ou note non rempli.

    Un zero laisserait croire a une evaluation nulle. La formule tombe
    avec la valeur : une moyenne sur des cellules vides redonnerait 0.
    """
    motif = re.compile(r'<c r="' + ref + r'"([^>]*?)(/>|>(.*?)</c>)', re.S)
    m = motif.search(feuille)
    if not m:
        return feuille
    attributs = re.sub(r'\s+t="\w+"', '', m.group(1))
    neuf = f'<c r="{ref}"{attributs} t="inlineStr"><is><t>-</t></is></c>'
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
        # Une serie dont on ne fournit aucune cellule garde le modele. Une
        # valeur absente (notes ou questionnaires pas remplis) laisse un
        # trou dans la serie, plutot qu'un zero.
        if not cellules_serie or not any(c in cellules for c in cellules_serie):
            return m.group(0)
        points = ''.join(f'<c:pt idx="{i}"><c:v>{float(cellules[c]):.10g}</c:v></c:pt>'
                         for i, c in enumerate(cellules_serie)
                         if cellules.get(c) is not None)
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
        feuille = (_poser_cellule(feuille, ref, valeur) if valeur is not None
                   else _poser_tiret(feuille, ref))
    parts['xl/worksheets/sheet1.xml'] = feuille.encode('utf-8')
    for nom in [n for n in parts if re.match(r'xl/charts/chart\d+\.xml$', n)]:
        parts[nom] = _cache(parts[nom].decode('utf-8'), cellules).encode('utf-8')
    return _etiquettes_anneau(parts, cellules)


def _largeur_texte(lignes, corps_pt):
    """La largeur, en points, de la plus longue ligne en Calibri gras."""
    from PIL import ImageFont
    for nom in POLICES_ETIQUETTES:
        try:
            police = ImageFont.truetype(nom, 100)
            break
        except OSError:
            continue
    else:
        return 0.55 * corps_pt * max(len(t) for t in lignes)
    return max(police.getlength(t) for t in lignes) * corps_pt / 100


def _etiquettes_anneau(parts, cellules):
    """Les etiquettes de l'anneau a la place qu'elles ont dans l'apercu.

    Excel place une etiquette par un decalage (`manualLayout`) depuis sa
    place par defaut, le milieu de l'arc de la valeur : celle-ci bouge avec
    la valeur. Le decalage du modele, garde tel quel, envoyait l'etiquette
    sur l'anneau des que les valeurs changeaient (vu en rafraichissant
    l'objet dans PowerPoint). Il est recalcule depuis `_disposition_anneau`,
    la meme disposition que celle de l'apercu.
    """
    geo = _geometrie_anneau(parts)
    nom = next((n for n in parts if re.match(r'xl/charts/chart\d+\.xml$', n)
                and b'<c:doughnutChart>' in parts[n]), None)
    if not geo or not nom:
        return parts
    graphique = parts[nom].decode('utf-8')
    series = re.findall(r'<c:ser>.*?</c:ser>', graphique, re.S)
    valeurs = []
    for ser in series:
        ref = re.search(r'<c:val><c:numRef><c:f>([^<]*)</c:f>', ser)
        premiere = (_plage(ref.group(1)) or [None])[0] if ref else None
        v = cellules.get(premiere)
        valeurs.append(None if v is None else float(v))
    places = _disposition_anneau(geo, valeurs)
    larg, haut = geo['cadre']
    for k, (ser, place, info) in enumerate(zip(series, places, geo['series'])):
        if not place:
            continue
        dx = (place['centre'][0] - place['defaut'][0]) / larg
        dy = (place['centre'][1] - place['defaut'][1]) / haut
        neuve = re.sub(
            r'(<c:dLbl><c:idx val="0"/><c:layout><c:manualLayout>)<c:x val="[^"]+"/><c:y val="[^"]+"/>',
            lambda m: f'{m.group(1)}<c:x val="{dx:.6g}"/><c:y val="{dy:.6g}"/>', ser, count=1)
        if k:
            # La boite du modele tient « l'accueil 88% » ; a 100 %, Excel
            # l'abregerait (« l'accueil... »). Elargie d'autant, a peine : le
            # nom entier ne doit pas tenir sur une ligne, coupee comme sur
            # l'apercu.
            mots = info['nom'].split()
            fin = mots[-1] if mots else ''
            facteur = (_largeur_texte([f'{fin} {round(valeurs[k] * 100)}%'], info['pt'])
                       / _largeur_texte([f'{fin} 88%'], info['pt']))
            neuve = re.sub(r'(<c15:layout><c:manualLayout><c:w val=")([^"]+)"',
                           lambda m: f'{m.group(1)}{float(m.group(2)) * max(1.0, facteur):.6g}"',
                           neuve, count=1)
        graphique = graphique.replace(ser, neuve, 1)
    parts[nom] = graphique.encode('utf-8')
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
    '+': dict(x0=0.33998, x1=0.43425, y0=0.62262, y1=0.77805, id_forme=2,
             nom='Signe Plus 1', nom_creation='8DE92517-B108-41BF-95A9-B83710DCFBEC'),
    # Centre sur la hauteur du « + », un peu moins haut que lui : les
    # deux signes se lisent sur une meme ligne.
    '=': dict(x0=0.6535, x1=0.7365, y0=0.63814, y1=0.76253, id_forme=3,
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


def _ancre_signe(prst, x0, x1, y0, y1, id_forme, nom, nom_creation, off_x, off_y):
    """Une forme du graphique (`cdr:relSizeAnchor`), en fraction de son cadre.

    `off_x`/`off_y` (EMU) alimentent le `xfrm` de la forme : un `<a:off>`
    a zero, correct pour la position reelle (donnee par le
    `relSizeAnchor`), a suffi a faire disparaitre la forme au rendu — le
    moteur de LibreOffice s'appuie visiblement aussi sur ce xfrm, meme
    quand `relSizeAnchor` prime dans PowerPoint.
    """
    return (
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
          '</cdr:relSizeAnchor>'
    )


def _userShapes(ancres):
    """Les formes du graphique ; les espaces de noms sur la racine."""
    return (
        '<c:userShapes xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" '
        'xmlns:cdr="http://schemas.openxmlformats.org/drawingml/2006/chartDrawing" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:a16="http://schemas.microsoft.com/office/drawing/2014/main">'
        + ''.join(ancres) + '</c:userShapes>'
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
    base = re.search(r'baseColWidth="([\d.]+)"', feuille)
    # Sans largeur par defaut explicite, Excel part de `baseColWidth`
    # (en caracteres) augmente de ses 5 px de marge.
    defaut = (float(defaut.group(1)) if defaut
              else float(base.group(1)) + 5 / 7 if base else 8.43)
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

    # Les deux signes dans le graphique, en fraction de son cadre : ils
    # suivent ses dimensions ensemble et restent alignes quel que soit
    # le classeur (un « = » pose sur la feuille, en position absolue,
    # derivait des que le cadre mesure differait de celui d'Excel).
    contenu_drawing = _userShapes([
        _ancre_signe(prst, f['x0'], f['x1'], f['y0'], f['y1'], f['id_forme'], f['nom'],
                     f['nom_creation'], cx + round(f['x0'] * cl), cy + round(f['y0'] * ch))
        for prst, f in (('mathPlus', SIGNES_ACQUISITION['+']),
                        ('mathEqual', SIGNES_ACQUISITION['=']))])

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
    # Le format « pourcentage » integre (numFmtId 9) suit la langue de
    # LibreOffice : « 85 % » en francais, quand Excel ecrit « 85% ». Un
    # format explicite « 0% » s'affiche pareil partout.
    styles = parts.get('xl/styles.xml', b'').decode('utf-8')
    if 'numFmtId="9"' in styles:
        styles = styles.replace('numFmtId="9"', 'numFmtId="190"')
        fmt = '<numFmt numFmtId="190" formatCode="0%"/>'
        if '<numFmts' in styles:
            styles = re.sub(r'(<numFmts[^>]*>)', lambda m: m.group(1) + fmt, styles, count=1)
        else:
            styles = re.sub(r'(<styleSheet[^>]*>)',
                            lambda m: m.group(1) + '<numFmts count="1">' + fmt + '</numFmts>',
                            styles, count=1)
        parts['xl/styles.xml'] = styles.encode('utf-8')
    # LibreOffice ignore la taille du trou d'un anneau (`c:holeSize`) :
    # il le dessine a un tiers du rayon, Excel a 75 %. Ses etiquettes,
    # placees pour l'anneau d'Excel, chevaucheraient le sien : le rendu
    # les retire, `_anneau_excel` redonne a l'anneau ses proportions et
    # pose les etiquettes comme Excel.
    for nom in [n for n in parts if re.match(r'xl/charts/chart\d+\.xml$', n)]:
        graphique = parts[nom].decode('utf-8')
        if '<c:doughnutChart>' in graphique:
            graphique = re.sub(r'<c:dLbls>.*?</c:dLbls>',
                               '<c:dLbls><c:delete val="1"/></c:dLbls>', graphique, flags=re.S)
            parts[nom] = graphique.encode('utf-8')
    return parts


# Les cellules des valeurs portees par chaque anneau, serie par serie
# (la premiere serie est l'anneau interieur).
ANNEAUX = {'satisfaction': ('B9', 'B18')}


def _geometrie_anneau(parts):
    """Ce qu'il faut du graphique en anneau pour le dessiner comme Excel.

    Taille du trou, zone de trace, cadre du graphique sur la feuille,
    et pour chaque serie : nom, decalage manuel de l'etiquette, corps.
    """
    graphique = next((parts[n].decode('utf-8') for n in parts
                      if re.match(r'xl/charts/chart\d+\.xml$', n)
                      and b'<c:doughnutChart>' in parts[n]), None)
    dessin = parts.get('xl/drawings/drawing1.xml', b'').decode('utf-8')
    if not graphique or not dessin:
        return None
    trou = re.search(r'<c:holeSize val="(\d+)"', graphique)
    zone = re.search(r'<c:plotArea><c:layout>.*?</c:layout>', graphique, re.S)
    zone = dict(re.findall(r'<c:([xywh]) val="([^"]+)"', zone.group(0))) if zone else {}
    series = []
    for ser in re.findall(r'<c:ser>.*?</c:ser>', graphique, re.S):
        nom = re.search(r'<c:tx>.*?<c:v>([^<]*)</c:v>', ser, re.S)
        dec = re.search(r'<c:dLbl><c:idx val="0"/><c:layout><c:manualLayout>'
                        r'<c:x val="([^"]+)"/><c:y val="([^"]+)"/>', ser)
        corps = re.search(r'<c:dLbl>.*?sz="(\d+)"', ser, re.S)
        boite = re.search(r'<c:dLbl><c:idx val="0"/>.*?<c15:layout><c:manualLayout>'
                          r'<c:w val="([^"]+)"/><c:h val="([^"]+)"/>', ser, re.S)
        series.append({
            'boite': tuple(map(float, boite.groups())) if boite else None,
            'nom': html.unescape(nom.group(1)) if nom else '',
            'dx': float(dec.group(1)) if dec else 0.0,
            'dy': float(dec.group(2)) if dec else 0.0,
            'pt': int(corps.group(1)) / 100 if corps else 16.0,
        })
    _, _, largeur, hauteur = _cadre_graphique(parts, dessin)
    if not largeur or not hauteur:
        return None
    return {
        'trou': int(trou.group(1)) / 100 if trou else 0.5,
        'zone': {k: float(v) for k, v in zone.items()} or {'x': 0, 'y': 0, 'w': 1, 'h': 1},
        'cadre': (largeur, hauteur),
        'series': series,
    }


# Polices des etiquettes de l'anneau, dans l'ordre d'essai.
POLICES_ETIQUETTES = (
    'calibrib.ttf',
    'Carlito-Bold.ttf',
    '/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
)

def _anneau_excel(image, geo, valeurs):
    """Redonne a l'anneau rendu par LibreOffice la geometrie d'Excel.

    LibreOffice trace l'anneau juste (angles, couleurs) mais avec son
    propre trou. On remappe chaque rayon — les angles ne bougent pas —
    pour retrouver le trou et l'epaisseur des anneaux d'Excel ; les
    secteurs vides reprennent leur remplissage blanc. Les etiquettes
    ont une place fixe (voir plus bas), au corps du graphique.
    """
    import math
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
    # En octets : seul le carre de l'anneau passe en flottants, plus bas.
    a = np.asarray(image.convert('RGBA'))
    h, l = a.shape[:2]
    opaque = a[:, :, 3] > 0

    # L'anneau : le bloc le plus bas de la moitie droite, puis, dans ses
    # rangs, le bloc de colonnes le plus a droite (le tableau est a sa
    # gauche en page 19, au-dessus sur la fiche). Le contour gris des
    # secteurs vides en ferme le cercle.
    def dernier_bloc(indices):
        fin = len(indices) - 1
        debut = fin
        while debut > 0 and indices[debut] - indices[debut - 1] <= 12:
            debut -= 1
        return int(indices[debut]), int(indices[fin])

    rangs = np.where(opaque[:, l // 2:].any(axis=1))[0]
    if not len(rangs):
        return image
    haut, bas = dernier_bloc(rangs)
    colonnes = np.where(opaque[haut:bas + 1].any(axis=0))[0]
    gauche, droite = dernier_bloc(colonnes)
    cx, cy = (gauche + droite) / 2, (haut + bas) / 2
    rayon = ((droite - gauche) + (bas - haut)) / 4
    if rayon < 20:
        return image

    # Trou de LibreOffice : le premier rayon ou le cercle est presque
    # entierement trace (contour ou couleur).
    ys, xs = np.nonzero(opaque[haut:bas + 1, gauche:droite + 1])
    r_pts = np.hypot(xs + gauche - cx, ys + haut - cy)
    profil = np.bincount(np.clip(r_pts, 0, rayon).astype(int), minlength=int(rayon) + 1)
    rempli = profil / np.maximum(2 * math.pi * np.arange(len(profil)), 1)
    trou_lo = next((r for r in range(int(rayon * 0.15), int(rayon * 0.9))
                    if rempli[r] > 0.5), rayon / 3)
    n = max(1, len(geo['series']))
    trou_xl = geo['trou'] * rayon
    ep_lo, ep_xl = (rayon - trou_lo) / n, (rayon - trou_xl) / n

    # Remappage radial, bilineaire, sur le carre de l'anneau.
    m = int(rayon) + 3
    x0, y0 = max(0, int(cx) - m), max(0, int(cy) - m)
    x1, y1 = min(l, int(cx) + m + 1), min(h, int(cy) + m + 1)
    gy, gx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    dx, dy = gx - cx, gy - cy
    r = np.hypot(dx, dy)
    dans = (r >= trou_xl) & (r <= rayon)
    k = np.clip(((r - trou_xl) / ep_xl).astype(int), 0, n - 1)
    r_src = trou_lo + k * ep_lo + (r - trou_xl - k * ep_xl) * ep_lo / ep_xl
    r_src = np.where(r > rayon, r, r_src)
    echelle = np.where(r > 0, r_src / np.maximum(r, 1e-6), 0)
    sx, sy = cx + dx * echelle, cy + dy * echelle
    sx0 = np.clip(np.floor(sx).astype(int), 0, l - 2)
    sy0 = np.clip(np.floor(sy).astype(int), 0, h - 2)
    fx, fy = (sx - sx0)[..., None], (sy - sy0)[..., None]
    f = np.float32
    pris = (a[sy0, sx0].astype(f) * (1 - fx) * (1 - fy) + a[sy0, sx0 + 1].astype(f) * fx * (1 - fy)
            + a[sy0 + 1, sx0].astype(f) * (1 - fx) * fy + a[sy0 + 1, sx0 + 1].astype(f) * fx * fy)
    # Les secteurs vides sont blancs chez Excel : sous l'anneau, le vide
    # redevient blanc.
    blanc = np.array([255, 255, 255, 255], np.float32)
    alpha = pris[..., 3:4] / 255
    pris = np.where(dans[..., None], pris * alpha + blanc * (1 - alpha), pris)
    pris = np.where((r < trou_xl)[..., None], 0, pris)
    b = a.copy()
    b[y0:y1, x0:x1] = np.clip(pris, 0, 255).astype(np.uint8)
    image = Image.fromarray(b, 'RGBA')

    # Echelle : la zone de trace d'Excel inscrit le cercle dans son plus
    # petit cote ; on en deduit la taille d'un point, en pixels.
    # (Excel l'agrandit d'environ 1,5 % : mesure sur ses propres objets.)
    z = geo['zone']
    larg_emu, haut_emu = geo['cadre']
    px = 2 * rayon / (min(z['w'] * larg_emu, z['h'] * haut_emu) * 1.015)
    pt = 12700 * px

    # Les etiquettes ont une place fixe, quel que soit le remplissage :
    # l'anneau interieur (formation) au centre du trou, l'exterieur
    # (accueil) dehors, a droite. Les traits de rappel ne coupent ni
    # l'anneau ni l'autre trait : celui du centre reste dans le trou,
    # l'autre sort de l'anneau dans l'axe du rayon puis le contourne a
    # angle droit, toujours au-dehors du cercle.
    mesure = ImageDraw.Draw(image)

    def police_de(corps):
        # Calibri gras sous Windows ; ailleurs Carlito, aux memes chasses.
        # Jamais la police bitmap de Pillow : minuscule et sans accents.
        for nom in POLICES_ETIQUETTES:
            try:
                return ImageFont.truetype(nom, corps)
            except OSError:
                continue
        return ImageFont.load_default(corps)

    def texte_de(serie, v):
        # Un questionnaire non rempli s'affiche d'un tiret, pas de 0 %.
        mots = serie['nom'].split()
        taux = '-' if v is None else f'{int(float(v) * 100 + 0.5)}%'
        return [' '.join(mots[:-1]), f"{mots[-1] if mots else ''} {taux}"]

    def bloc(texte, corps):
        police = police_de(corps)
        lw = max(mesure.textlength(t, font=police) for t in texte)
        return police, lw, corps * 1.22 * len(texte)

    series = list(zip(geo['series'], valeurs))
    etiquettes = []
    if series and series[0][1] is not None:
        serie, v = series[0]
        texte = texte_de(serie, v)
        # Le texte tient dans le trou, avec une marge.
        corps = max(10, round(serie['pt'] * pt))
        police, lw, lh = bloc(texte, corps)
        while corps > 10 and (lw / 2) ** 2 + (lh / 2) ** 2 > (trou_xl * 0.88) ** 2:
            corps -= 1
            police, lw, lh = bloc(texte, corps)
        angle = math.radians(float(v or 0) * 180)
        dirx, diry = math.sin(angle), -math.cos(angle)
        # Droit, du bord de la boite au milieu de l'anneau, dans l'axe du rayon.
        rm = trou_xl + 0.5 * ep_xl
        trait = _trait_rayon((cx, cy), (lw / 2, lh / 2), (cx + dirx * rm, cy + diry * rm), rayon)
        etiquettes.append((texte, police, lh, cx, cy, trait))
    if len(series) > 1 and series[1][1] is not None:
        serie, v = series[1]
        texte = texte_de(serie, v)
        police, lw, lh = bloc(texte, max(10, round(serie['pt'] * pt)))
        # La place et le trait de l'objet Excel (`_disposition_anneau`),
        # ramenes de ses EMU aux pixels de l'image.
        place = _disposition_anneau(geo, list(valeurs))[1]
        z = geo['zone']
        cx_e = (z['x'] + z['w'] / 2) * larg_emu
        cy_e = (z['y'] + z['h'] / 2) * haut_emu
        echelle = rayon / (1.015 * min(z['w'] * larg_emu, z['h'] * haut_emu) / 2)

        def en_pixels(x, y):
            return cx + (x - cx_e) * echelle, cy + (y - cy_e) * echelle
        ex, ey = en_pixels(*place['centre'])
        trait = [en_pixels(x, y) for x, y in place['trait']]
        etiquettes.append((texte, police, lh, ex, ey, trait))

    # La toile s'agrandit si une etiquette deborde de l'image rognee.
    def boite(e):
        texte, police, lh, ex, ey, _ = e
        lw = max(mesure.textlength(t, font=police) for t in texte)
        return ex - lw / 2 - 4, ey - lh / 2 - 4, ex + lw / 2 + 4, ey + lh / 2 + 4
    # Les traits comptent aussi : sous l'anneau, celui de l'accueil peut
    # descendre plus bas que l'image rognee.
    boites = [boite(e) for e in etiquettes] + [
        (x - 4, y - 4, x + 4, y + 4) for e in etiquettes for x, y in e[5]]
    g = min([0] + [b[0] for b in boites])
    t_ = min([0] + [b[1] for b in boites])
    d = max([image.width] + [b[2] for b in boites])
    f = max([image.height] + [b[3] for b in boites])
    dx0, dy0 = -int(math.floor(g)), -int(math.floor(t_))
    if dx0 or dy0 or d > image.width or f > image.height:
        toile = Image.new('RGBA', (int(math.ceil(d)) + dx0, int(math.ceil(f)) + dy0),
                          (255, 255, 255, 0))
        toile.paste(image, (dx0, dy0))
        image = toile
    dessin = ImageDraw.Draw(image)
    epaisseur = max(1, round(rayon / 180))
    gris = (89, 89, 89, 255)
    for texte, police, lh, ex, ey, trait in etiquettes:
        if trait:
            dessin.line([(x + dx0, y + dy0) for x, y in trait], fill=gris,
                        width=epaisseur, joint='curve')
        pas = lh / len(texte)
        y = ey + dy0 - lh / 2
        for ligne in texte:
            dessin.text((ex + dx0 - dessin.textlength(ligne, font=police) / 2, y), ligne,
                        font=police, fill=(0, 0, 0, 255))
            y += pas
    # Ou l'image d'entree a atterri sur la toile agrandie.
    image.info['decalage'] = (dx0, dy0)
    return image


def _sans_blanc(image):
    """L'image en RGBA, son blanc rendu transparent."""
    from PIL import ImageChops
    image = image.convert('RGB')
    blanc = None
    for canal in image.split():
        clair = canal.point(lambda v: 255 if v >= 248 else 0)
        blanc = clair if blanc is None else ImageChops.multiply(blanc, clair)
    image.putalpha(ImageChops.invert(blanc))
    return image


def _rogner(pixmap_png, anneau=None, ratio=None, cadre=None):
    """L'image rognee a son contenu, le blanc rendu transparent.

    L'EMF du modele n'a pas de fond : pose sur la moitie grise de la
    page, le tableau prend la couleur de la page. Le blanc du rendu
    devient donc transparent.

    `cadre` impose celui de l'image complete (voir `_cadre_de`) : une
    note absente laisse sa place vide, le reste garde place et echelle.
    """
    from PIL import Image
    image = _sans_blanc(pixmap_png if isinstance(pixmap_png, Image.Image)
                        else Image.open(io.BytesIO(pixmap_png)))
    boite = cadre[:4] if cadre else image.getbbox()
    if boite:
        image = image.crop(boite)
    if anneau:
        image = _anneau_excel(image, *anneau)
    if cadre:
        largeur, hauteur, ox, oy = cadre[4:]
        dx, dy = image.info.get('decalage', (0, 0))
        toile = Image.new('RGBA', (max(largeur, image.width), max(hauteur, image.height)),
                          (255, 255, 255, 0))
        toile.paste(image, (max(0, ox - dx), max(0, oy - dy)))
        image = toile
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
    # optimize=True quadruple le temps pour un fichier a peine plus petit.
    sortie = io.BytesIO()
    image.save(sortie, 'PNG', compress_level=6)
    return sortie.getvalue()


# A changer quand le dessin d'un classeur change a classeur identique.
VERSION_IMAGES = 7


def _cadre_de(rendu, reference):
    """Le cadre de l'image complete : sa boite sur la page rendue, puis la
    taille de sa toile et la place de la boite sur celle-ci, une fois les
    etiquettes de l'anneau posees (celle de l'accueil l'elargit)."""
    image = _sans_blanc(rendu)
    boite = image.getbbox()
    if not boite:
        return None
    image = image.crop(boite)
    geo = _geometrie_anneau(_lire(reference))
    if geo:
        taux = [NOTES_DE_REFERENCE[ref] for ref in ANNEAUX['satisfaction']]
        image = _anneau_excel(image, geo, taux)
    return (*boite, image.width, image.height, *image.info.get('decalage', (0, 0)))


def _page_rendue(pdf):
    """La premiere page d'un PDF de LibreOffice, en image."""
    import fitz
    from PIL import Image
    with fitz.open(pdf) as doc:
        pixmap = doc[0].get_pixmap(dpi=200)
    return Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)


def rendre(classeurs_bruts, soffice, profil, cache, legendes=None):
    """Les images des classeurs, depuis le cache ou fraichement rendues.

    Tous les classeurs a rendre passent dans un seul appel a LibreOffice :
    c'est son lancement qui coute.

    `legendes[cle]` : `(nature, cellules, ratio[, reference])`. La
    reference est un classeur dont l'image donne le cadre de celle-ci.
    """
    dossier = Path(cache) / 'classeurs'
    dossier.mkdir(parents=True, exist_ok=True)

    def legende(cle):
        return (tuple((legendes or {}).get(cle, ())) + (None,) * 4)[:4]

    def signe(brut):
        return hashlib.sha1(brut).hexdigest()[:16]

    images, a_faire, cadres, references = {}, {}, {}, {}
    for cle, brut in classeurs_bruts.items():
        # Le meme classeur peut tenir dans deux cadres de proportions
        # differentes : l'image en depend aussi.
        _, _, ratio, reference = legende(cle)
        empreinte = hashlib.sha1(brut + f'|v{VERSION_IMAGES}|{ratio}'.encode()).hexdigest()[:16]
        chemin = dossier / f'{empreinte}.png'
        if chemin.exists():
            images[cle] = chemin.read_bytes()
            continue
        a_faire[cle] = (empreinte, signe(brut), brut)
        if reference:
            cadre = dossier / f'{signe(reference)}-v{VERSION_IMAGES}.cadre'
            if cadre.exists():
                cadres[signe(reference)] = tuple(map(int, cadre.read_text().split()))
            else:
                references[signe(reference)] = reference
    if not a_faire:
        return images
    travail = Path(tempfile.mkdtemp(prefix='cr-classeurs-'))
    try:
        # Deux classeurs identiques ne passent qu'une fois par LibreOffice.
        uniques = {source: brut for _, source, brut in a_faire.values()} | references
        for source, brut in uniques.items():
            (travail / f'{source}.xlsx').write_bytes(_ecrire(_pour_rendu(_lire(brut))))
        with LIBREOFFICE:
            subprocess.run(
                [soffice, '--headless', '--norestore', f'-env:UserInstallation={profil}',
                 '--convert-to', 'pdf', '--outdir', str(travail)]
                + [str(travail / f'{s}.xlsx') for s in uniques],
                capture_output=True, timeout=120)
        for source, reference in references.items():
            pdf = travail / f'{source}.pdf'
            cadre = _cadre_de(_page_rendue(pdf), reference) if pdf.exists() else None
            if cadre:
                cadre = tuple(int(v) for v in cadre)
                cadres[source] = cadre
                (dossier / f'{source}-v{VERSION_IMAGES}.cadre').write_text(' '.join(map(str, cadre)))
        # Une image a la fois, liberee aussitot : chacune pese une
        # dizaine de Mo une fois decodee, et la machine en a peu.
        source_vue, rendu = None, None
        for cle, (empreinte, source, _) in sorted(a_faire.items(), key=lambda t: t[1][1]):
            if source != source_vue:
                source_vue, rendu = source, None
                pdf = travail / f'{source}.pdf'
                if pdf.exists():
                    rendu = _page_rendue(pdf)
            if rendu is None:
                continue
            quoi, cellules, ratio, reference = legende(cle)
            anneau = None
            taux = [(cellules or {}).get(ref) for ref in ANNEAUX.get(quoi, ())]
            # La serie d'une note absente a quitte le graphique : les taux
            # restants suivent les series restantes.
            if quoi == 'satisfaction' and cellules:
                absentes = _moities_absentes(cellules)
                taux = [t for i, t in enumerate(taux) if i not in absentes]
            # Aucun questionnaire rempli : LibreOffice ne trace pas
            # d'anneau, il n'y a rien a reprendre ni a legender.
            if quoi in ANNEAUX and any(v is not None for v in taux):
                geo = _geometrie_anneau(_lire(classeurs_bruts[cle]))
                if geo:
                    anneau = (geo, taux)
            cadre = cadres.get(signe(reference)) if reference else None
            image = _rogner(rendu, anneau, ratio, cadre)
            (dossier / f'{empreinte}.png').write_bytes(image)
            images[cle] = image
    finally:
        shutil.rmtree(travail, ignore_errors=True)
    return images


# Ce qui n'a de sens qu'avec l'objet de satisfaction : le titre de sa
# colonne sur la fiche individuelle, la pastille entre ses deux tableaux
# sur la page de resultats.
RE_ORPHELINS = (
    re.compile(r'<p:sp>(?:(?!</p:sp>).)*?<a:t>APPRECIATION DE LA FORMATION ET DE L.ACCUEIL</a:t>'
               r'(?:(?!</p:sp>).)*?</p:sp>', re.S),
    re.compile(r'<p:grpSp>(?:(?!</p:grpSp>).)*?name="Groupe 13".*?</p:grpSp>', re.S),
)


# Les deux moities du classeur de satisfaction : les cellules de chacune
# et les lignes qu'elle occupe (formation en haut, accueil dessous).
MOITIES_SATISFACTION = (
    (('B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'C9'), range(1, 10)),
    (('B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'C18'), range(11, 19)),
)


# Deux notes fictives, le temps de mesurer le cadre de l'image complete.
NOTES_DE_REFERENCE = {c: 0.88 for cellules, _ in MOITIES_SATISFACTION for c in cellules} | {
    'C9': 0.12, 'C18': 0.12}


def _moities_absentes(valeurs):
    """Les index des moities dont aucune note n'existe."""
    return [i for i, (cellules, _) in enumerate(MOITIES_SATISFACTION)
            if all(valeurs.get(c) is None for c in cellules)]


def _sans_moitie_absente(parts, valeurs):
    """Retire du classeur le tableau et l'anneau d'une note absente.

    C'est le classeur embarque qui change, pas seulement son image :
    ouvert dans PowerPoint, il ne montre plus que la note presente.
    Cellules (titre compris) et fusion du titre disparaissent, la serie
    du graphique aussi ; il reste un anneau, celui de l'autre note. Les
    lignes gardent leur place, le graphique reste ancre ou il est.

    Le retrait est definitif : il s'applique a un classeur tire du modele
    (`rapport` et `remplir` repartent toujours de lui), jamais a un
    classeur deja traite.
    """
    absentes = _moities_absentes(valeurs)
    if not absentes:
        return parts
    parts = dict(parts)
    feuille = parts['xl/worksheets/sheet1.xml'].decode('utf-8')
    for i in absentes:
        lignes = MOITIES_SATISFACTION[i][1]
        for n in lignes:
            feuille = re.sub(
                rf'<c r="([A-C]){n}"[^>]*?(?:/>|>.*?</c>)',
                lambda m, n=n: f'<c r="{m.group(1)}{n}"/>', feuille, flags=re.S)
        feuille = re.sub(rf'<mergeCell ref="A{lignes[0]}:[A-Z]+{lignes[0]}"/>', '', feuille)
    reste = len(re.findall(r'<mergeCell ', feuille))
    feuille = (re.sub(r'<mergeCells count="\d+">', f'<mergeCells count="{reste}">', feuille)
               if reste else re.sub(r'<mergeCells[^>]*>\s*</mergeCells>', '', feuille))
    parts['xl/worksheets/sheet1.xml'] = feuille.encode('utf-8')
    # La serie d'une moitie : celle dont une reference tombe sur ses lignes.
    lignes_absentes = {n for i in absentes for n in MOITIES_SATISFACTION[i][1]}

    def hors_moitie(m):
        refs = re.findall(r'<c:f>[^<]*?\$?[A-Z]+\$?(\d+)', m.group(0))
        return '' if any(int(n) in lignes_absentes for n in refs) else m.group(0)
    for nom in [n for n in parts if re.match(r'xl/charts/chart\d+\.xml$', n)]:
        graphique = parts[nom].decode('utf-8')
        if '<c:doughnutChart>' in graphique:
            graphique = re.sub(r'<c:ser>.*?</c:ser>', hors_moitie, graphique, flags=re.S)
            # Seule, une serie donne son nom en titre au graphique : ce
            # titre automatique n'existe pas dans le modele.
            graphique = graphique.replace('<c:autoTitleDeleted val="0"/>',
                                          '<c:autoTitleDeleted val="1"/>')
            restante = next((i for i in range(len(MOITIES_SATISFACTION)) if i not in absentes), None)
            if restante is not None:
                graphique = _etiquette_au_centre(
                    parts, graphique, valeurs.get(ANNEAUX['satisfaction'][restante]))
            parts[nom] = graphique.encode('utf-8')
    return parts


def _trait_rayon(centre, demi, point, rayon):
    """Le trait de l'etiquette du centre : droit, du bord de sa boite au point.

    Il suit le rayon ; rien s'il n'a pas la place de sortir de la boite.
    """
    (cx, cy), (dw, dh), (px, py) = centre, demi, point
    long = math.hypot(px - cx, py - cy)
    if long < 1e-9:
        return []
    ux, uy = (px - cx) / long, (py - cy) / long
    t = min(dw / abs(ux) if abs(ux) > 1e-6 else math.inf,
            dh / abs(uy) if abs(uy) > 1e-6 else math.inf) + 0.04 * rayon
    return [(cx + ux * t, cy + uy * t), (px, py)] if t < long - 0.05 * rayon else []


def _trait_accueil(centre, rayon, point, texte, cadre):
    """Place de l'etiquette de l'anneau exterieur et son trait de rappel.

    L'etiquette va a droite du cercle, a la hauteur du point (milieu de la
    partie remplie) quand elle y tient : un seul trait horizontal qui
    arrive au milieu de son texte. Sinon elle monte ou descend jusqu'a la
    hauteur libre la plus proche et le trait la rejoint en equerre : a
    l'horizontale hors du cercle, puis a la verticale jusqu'au haut ou au
    bas du texte. Jamais de segment penche ni de traversee de l'anneau : le
    point est sur la moitie droite (milieu de l'arc, entre 0 et 180 degres)
    et chaque segment s'eloigne du centre ou reste dehors. `texte` : la
    taille du texte de l'etiquette, sans marge.
    """
    (cx, cy), (px, py), (tw, th), (larg, haut) = centre, point, texte, cadre
    jeu, marge = 0.06 * rayon, 0.03 * rayon
    lw, lh = tw + 2 * marge, th + 2 * marge
    bas_min, haut_max = lh / 2 + 0.01 * haut, haut - lh / 2 - 0.01 * haut
    gauche = max(cx + rayon * 0.3, min(cx + rayon + jeu, larg * 0.99 - lw))
    # En deca de `ecart` du centre, le cercle deborde sous l'etiquette.
    ecart = math.sqrt(max(0.0, (rayon + jeu) ** 2 - (gauche - cx) ** 2))
    milieu_x = gauche + lw / 2

    def libre(y):
        return bas_min - 1 <= y <= haut_max + 1 and abs(y - cy) >= ecart + lh / 2 - 1

    def borne(y):
        return min(max(y, bas_min), haut_max)

    # Les hauteurs permises, de la plus proche du point a la plus lointaine.
    vers_bas = py >= cy
    hauteurs = sorted({borne(py), borne(cy + ecart + lh / 2), borne(cy - ecart - lh / 2)},
                      key=lambda y: abs(y - py))
    hauteurs = [y for y in hauteurs if libre(y)] or [borne(py)]
    for y in hauteurs:
        if abs(y - py) <= 0.3 * th:
            return (milieu_x, y), [(px, py), (gauche, py)]
        # Assez loin pour un vrai segment vertical, quitte a s'ecarter.
        sens = 1 if y > py else -1
        if abs(y - py) < lh / 2 + 0.12 * rayon:
            y = py + sens * (lh / 2 + 0.12 * rayon)
            if not libre(y):
                continue
        arrivee = y - sens * lh / 2
        proche = (0.0 if min(py, arrivee) <= cy <= max(py, arrivee)
                  else min(abs(py - cy), abs(arrivee - cy)))
        x = max(cx + math.sqrt(max(0.0, (rayon + jeu) ** 2 - proche ** 2)), gauche + lw * 0.2)
        if x <= gauche + lw * 0.8:
            return (milieu_x, y), [(px, py), (x, py), (x, arrivee)]
    # Rien de mieux : a la hauteur du point, au plus pres du cadre.
    y = borne(py)
    if abs(y - py) <= th / 2:
        return (milieu_x, y), [(px, py), (gauche, py)]
    couloir = (px + gauche) / 2
    return (milieu_x, y), [(px, py), (couloir, py), (couloir, y), (gauche, y)]


def _disposition_anneau(geo, valeurs):
    """Ou vont les etiquettes de l'anneau et leurs traits, en EMU du graphique.

    Une seule disposition pour l'apercu (`_anneau_excel`) et pour l'objet
    Excel (decalages des etiquettes, `_trait_de_rappel`) : rafraichi dans
    PowerPoint, l'objet montre ce que montrait l'apercu. Par serie :
    `defaut` (place d'Excel sans decalage, le milieu de l'arc), `centre`
    et `boite` de l'etiquette (son texte, hors du centre), `trait` ; None
    sans valeur.
    """
    larg, haut = geo['cadre']
    z, n = geo['zone'], max(1, len(geo['series']))
    # Excel trace l'anneau environ 1,5 % plus grand que sa zone de trace.
    rayon = 1.015 * min(z['w'] * larg, z['h'] * haut) / 2
    cx, cy = (z['x'] + z['w'] / 2) * larg, (z['y'] + z['h'] / 2) * haut
    trou = geo['trou'] * rayon
    ep = (rayon - trou) / n
    places = []
    for k, (serie, v) in enumerate(zip(geo['series'], valeurs)):
        if v is None:
            places.append(None)
            continue
        angle = float(v) * math.pi
        rm = trou + (k + 0.5) * ep
        point = (cx + math.sin(angle) * rm, cy - math.cos(angle) * rm)
        mots = serie['nom'].split()
        lignes = [' '.join(mots[:-1]), f"{mots[-1] if mots else ''} {round(float(v) * 100)}%"]
        texte = (_largeur_texte(lignes, serie['pt']) * 12700 * 1.05,
                 serie['pt'] * 1.22 * 2 * 12700)
        if k == 0:
            boite = ((serie['boite'][0] * larg, serie['boite'][1] * haut)
                     if serie.get('boite') else texte)
            centre = (cx, cy)
            trait = _trait_rayon(centre, (boite[0] / 2, boite[1] / 2), point, rayon)
        else:
            boite = texte
            centre, trait = _trait_accueil((cx, cy), rayon, point, texte, (larg, haut))
        places.append({'defaut': point, 'centre': centre, 'boite': boite, 'trait': trait})
    return places


TRAIT_FORMES = 'xl/drawings/drawingTrait.xml'
NS_A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'


def _trait_de_rappel(parts):
    """Les traits de rappel de l'anneau, dessines dans le graphique Excel.

    Le trait d'Excel est une ligne droite tiree ou il veut, penchee le plus
    souvent ; on l'eteint et on pose a sa place des formes du graphique
    (`userShapes`) : les traits de `_disposition_anneau`, ceux de l'apercu.
    Rafraichi dans PowerPoint, l'objet les garde.
    """
    geo = _geometrie_anneau(parts)
    nom = next((n for n in parts if re.match(r'xl/charts/chart\d+\.xml$', n)
                and b'<c:doughnutChart>' in parts[n]), None)
    if not geo or not nom or not geo['series']:
        return parts
    graphique = parts[nom].decode('utf-8')
    valeurs = []
    for ser in re.findall(r'<c:ser>.*?</c:ser>', graphique, re.S):
        valeur = re.search(r'<c:val>.*?<c:pt idx="0"><c:v>([^<]+)</c:v>', ser, re.S)
        try:
            valeurs.append(float(valeur.group(1)) if valeur else None)
        except ValueError:
            valeurs.append(None)
    traits = [p['trait'] for p in _disposition_anneau(geo, valeurs) if p and p['trait']]
    graphique = graphique.replace('<c:showLeaderLines val="1"/>', '<c:showLeaderLines val="0"/>')
    if not traits:
        parts[nom] = graphique.encode('utf-8')
        return parts
    if '<c:userShapes ' not in graphique:
        if 'xmlns:r=' not in re.search(r'<c:chartSpace[^>]*>', graphique).group(0):
            graphique = graphique.replace(
                '<c:chartSpace ', '<c:chartSpace xmlns:r="http://schemas.openxmlformats.org/'
                'officeDocument/2006/relationships" ', 1)
        graphique = graphique.replace('</c:chartSpace>',
                                      '<c:userShapes r:id="rIdTrait"/></c:chartSpace>')
        rels = nom.replace('charts/', 'charts/_rels/') + '.rels'
        lien = ('<Relationship Id="rIdTrait" Type="http://schemas.openxmlformats.org/'
                'officeDocument/2006/relationships/chartUserShapes" '
                f'Target="../drawings/{TRAIT_FORMES.rsplit("/", 1)[1]}"/>')
        if rels in parts:
            parts[rels] = parts[rels].replace(b'</Relationships>',
                                              lien.encode('utf-8') + b'</Relationships>')
        else:
            parts[rels] = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                           '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/'
                           f'relationships">{lien}</Relationships>').encode('utf-8')
        types = parts['[Content_Types].xml'].decode('utf-8')
        if f'PartName="/{TRAIT_FORMES}"' not in types:
            types = types.replace('</Types>', f'<Override PartName="/{TRAIT_FORMES}" ContentType='
                                  '"application/vnd.openxmlformats-officedocument.drawingml.'
                                  'chartshapes+xml"/></Types>')
            parts['[Content_Types].xml'] = types.encode('utf-8')
    parts[nom] = graphique.encode('utf-8')

    larg, haut = geo['cadre']
    formes = []
    for i, points in enumerate(traits):
        x0, x1 = min(x for x, _ in points), max(x for x, _ in points)
        y0, y1 = min(y for _, y in points), max(y for _, y in points)
        w, h = max(1, round(x1 - x0)), max(1, round(y1 - y0))
        chemin = ''.join(
            f'<a:{"moveTo" if j == 0 else "lnTo"}><a:pt x="{round(x - x0)}" y="{round(y - y0)}"/>'
            f'</a:{"moveTo" if j == 0 else "lnTo"}>' for j, (x, y) in enumerate(points))
        formes.append(
            '<cdr:relSizeAnchor xmlns:cdr="http://schemas.openxmlformats.org/drawingml/2006/chartDrawing">'
            f'<cdr:from><cdr:x>{x0 / larg:.6f}</cdr:x><cdr:y>{y0 / haut:.6f}</cdr:y></cdr:from>'
            f'<cdr:to><cdr:x>{(x0 + w) / larg:.6f}</cdr:x><cdr:y>{(y0 + h) / haut:.6f}</cdr:y></cdr:to>'
            f'<cdr:sp macro="" textlink=""><cdr:nvSpPr><cdr:cNvPr id="{i + 2}" name="Trait de rappel {i + 1}"/>'
            '<cdr:cNvSpPr/></cdr:nvSpPr><cdr:spPr>'
            '<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/>'
            f'<a:pathLst><a:path w="{w}" h="{h}" fill="none">{chemin}</a:path></a:pathLst>'
            '</a:custGeom><a:noFill/>'
            '<a:ln w="9525"><a:solidFill><a:srgbClr val="595959"/></a:solidFill></a:ln>'
            '</cdr:spPr></cdr:sp></cdr:relSizeAnchor>')
    parts[TRAIT_FORMES] = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        f'<c:userShapes xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" {NS_A}>'
        + ''.join(formes) + '</c:userShapes>').encode('utf-8')
    return parts


def _etiquette_au_centre(parts, graphique, v):
    """L'etiquette de l'anneau seul, au centre de son trou, comme sur l'image.

    Le decalage du modele (`manualLayout` de l'etiquette) vaut pour deux
    anneaux. Excel le compte depuis la place par defaut de l'etiquette :
    le milieu du secteur, a mi-epaisseur de l'anneau. Le decalage qui
    ramene cette place au centre en est l'oppose, en fraction du graphique.
    """
    import math
    dessin = parts.get('xl/drawings/drawing1.xml', b'').decode('utf-8')
    zone = re.search(r'<c:plotArea><c:layout>.*?</c:layout>', graphique, re.S)
    trou = re.search(r'<c:holeSize val="(\d+)"', graphique)
    if not dessin or not zone:
        return graphique
    _, _, largeur, hauteur = _cadre_graphique(parts, dessin)
    z = {k: float(x) for k, x in re.findall(r'<c:([wh]) val="([^"]+)"', zone.group(0))}
    if not largeur or not hauteur or set(z) != {'w', 'h'}:
        return graphique
    rayon = min(z['w'] * largeur, z['h'] * hauteur) / 2
    milieu = rayon * (1 + (int(trou.group(1)) / 100 if trou else 0.5)) / 2
    angle = math.pi * float(v or 0)
    dx = -milieu * math.sin(angle) / largeur
    dy = milieu * math.cos(angle) / hauteur
    return re.sub(
        r'(<c:dLbl><c:idx val="0"/><c:layout><c:manualLayout>)<c:x val="[^"]+"/><c:y val="[^"]+"/>',
        lambda m: m.group(1) + f'<c:x val="{dx:.6g}"/><c:y val="{dy:.6g}"/>', graphique, count=1)


def _sans_orphelins(xml):
    for motif in RE_ORPHELINS:
        xml = motif.sub('', xml)
    return xml


def rafraichir(contenus, slides, valeurs, soffice, profil, cache):
    """Remplit les classeurs des diapositives `slides` et refait leur image.

    `valeurs` : `{nature: {cellule: valeur}}`. Un classeur dont la nature
    n'a pas de valeurs garde son etat du modele.
    """
    rafraichir_pages(contenus, [(s, valeurs) for s in slides], soffice, profil, cache)


def rafraichir_pages(contenus, pages, soffice, profil, cache):
    """Comme `rafraichir`, chaque diapositive avec ses propres valeurs.

    `pages` : `[(diapositive, valeurs)]`. Le rapport complet porte une
    fiche par stagiaire, chacune avec son graphique : tous passent dans
    un seul lancement de LibreOffice plutot qu'un par page.
    """
    types = contenus['[Content_Types].xml'].decode('utf-8')
    a_rendre, poses, natures = {}, [], {}
    for slide, valeurs in pages:
        if not valeurs:
            continue
        rels_nom = slide.replace('slides/', 'slides/_rels/') + '.rels'
        if slide not in contenus or rels_nom not in contenus:
            continue
        xml = contenus[slide].decode('utf-8')
        rels = contenus[rels_nom].decode('utf-8')
        cibles = dict(re.findall(r'Id="([^"]+)"[^>]*?Target="([^"]+)"', rels))
        retirer = []
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
            # Sans aucune note de qualite, ni tableaux ni anneau : on
            # retire l'objet plutot que d'afficher des tirets.
            if (quoi == 'satisfaction' and valeurs[quoi]
                    and len(_moities_absentes(valeurs[quoi])) == len(MOITIES_SATISFACTION)):
                retirer.append(m.span())
                continue
            remplies = remplir_classeur(parts, valeurs[quoi])
            if quoi == 'acquisition':
                remplies = _ajouter_signes_acquisition(remplies)
            reference = None
            if quoi == 'satisfaction' and valeurs[quoi] and _moities_absentes(valeurs[quoi]):
                remplies = _sans_moitie_absente(remplies, valeurs[quoi])
                # Le cadre de l'image vient du classeur aux deux notes : le
                # tableau restant garde sa place et l'anneau son echelle.
                reference = _ecrire(remplir_classeur(parts, NOTES_DE_REFERENCE))
            if quoi == 'satisfaction':
                remplies = _trait_de_rappel(remplies)
            brut = _ecrire(remplies)
            contenus[emb] = brut
            a_rendre[emb] = brut
            # L'image s'etire aux proportions du cadre de l'objet, qui ne
            # sont pas toujours celles de l'EMF (page 27) : c'est sur le
            # cadre qu'on les prend, sinon l'anneau devient ovale.
            taille = (re.search(r'<a:ext cx="(\d+)" cy="(\d+)"', m.group(0))
                      or re.search(r'imgW="(\d+)" imgH="(\d+)"', m.group(0)))
            ratio = int(taille.group(1)) / int(taille.group(2)) if taille else None
            natures[emb] = (quoi, valeurs[quoi], ratio, reference)
            poses += [(rels_nom, rid, emb) for rid in images]
        if retirer:
            for debut, fin in reversed(retirer):
                xml = xml[:debut] + xml[fin:]
            xml = _sans_orphelins(xml)
            contenus[slide] = xml.encode('utf-8')
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
