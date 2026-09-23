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
        if not cellules_serie or not all(c in cellules for c in cellules_serie):
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
    # L'anneau occupe la droite de l'image ; le tableau, a gauche, porte
    # les memes couleurs et ne doit pas fausser la recherche.
    xs, ys = [], []
    for y in range(0, h, 3):
        for x in range(l // 2, l, 3):
            r, g, b, a = pixels[x, y]
            if a and any(abs(r - c[0]) + abs(g - c[1]) + abs(b - c[2]) < 60
                         for c, _, _ in entrees):
                xs.append(x)
                ys.append(y)
    if not xs:
        return image
    gauche, droite, bas = min(xs), max(xs), max(ys)
    taille = max(14, round(h * 0.045))
    try:
        police = ImageFont.truetype('calibrib.ttf', taille)
    except OSError:
        police = ImageFont.load_default()
    lignes = []
    for couleur, libelle, ref in entrees:
        v = cellules.get(ref)
        # Arrondi a l'unite superieure des 0,5, comme le format « 0 % »
        # d'Excel : le tableau voisin et la legende disent le meme chiffre.
        lignes.append((couleur, f'{libelle} : {int(float(v) * 100 + 0.5)} %'
                       if v is not None else libelle))
    pas = round(taille * 1.5)
    besoin = bas + round(taille * 0.8) + pas * len(lignes)
    if besoin > h:
        from PIL import Image
        agrandie = Image.new('RGBA', (l, besoin), (255, 255, 255, 0))
        agrandie.paste(image, (0, 0))
        image = agrandie
    dessin = ImageDraw.Draw(image)
    largeur = max(dessin.textlength(t, font=police) for _, t in lignes) + taille * 1.4
    x0 = round((gauche + droite) / 2 - largeur / 2)
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
    # retrouve par un bord transparent, pour ne rien deformer.
    if ratio:
        from PIL import Image
        l, h = image.size
        cible_l, cible_h = max(l, round(h * ratio)), max(h, round(l / ratio))
        if (cible_l, cible_h) != (l, h):
            cadre = Image.new('RGBA', (cible_l, cible_h), (255, 255, 255, 0))
            cadre.paste(image, ((cible_l - l) // 2, 0))
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
            brut = _ecrire(remplir_classeur(parts, valeurs[quoi]))
            contenus[emb] = brut
            a_rendre[emb] = brut
            taille = re.search(r'imgW="(\d+)" imgH="(\d+)"', m.group(0))
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
