# -*- coding: utf-8 -*-
"""La mise en page finale d'une diapositive remplie.

LibreOffice, qui dessine les apercus, reduit a la volee un texte trop
long pour sa zone (« ajuster le texte ») : l'apercu parait juste.
PowerPoint, lui, ne recalcule cet ajustement qu'a la premiere frappe
dans la zone ; le rapport telecharge s'ouvrait avec des textes qui
sortaient de la page ou venaient toucher les deux logos du bas.

On fait donc le calcul ici, une fois pour les deux : la taille du
texte est ecrite en clair, assez petite pour tenir dans sa zone, et
aucune zone ne descend sous `LIMITE_BAS`, le haut des logos moins une
marge. Le pied de page (intitule et dates de la formation, ou le nom
du masque) n'apporte rien au rapport et venait se placer entre les
deux logos : il est retire.

L'estimation compte les lignes d'apres une chasse moyenne de la police
(Arial Nova) ; elle est volontairement un peu large.
"""
import re

EMU_PAR_CM = 360000
PT = 12700
# Le haut des logos du masque est a 17,90 cm : on garde 0,25 cm d'air.
LIMITE_BAS = round(17.65 * EMU_PAR_CM)
# La largeur moyenne d'un caractere, en fraction du corps : mesuree sur
# les commentaires d'un rapport remis en page dans PowerPoint (Arial Nova
# Light), un peu elargie par prudence.
CHASSE = 0.41
CHASSE_GRAS = 0.45
INTERLIGNE = 1.2
# Un texte ne descend pas sous ce corps (en centiemes de point).
CORPS_MIN = 800
# Ce qu'un commentaire peut remonter sur le graphique qu'il legende.
REMONTEE_MAX = round(0.75 * EMU_PAR_CM)
# Le pas de reduction d'une zone qui deborde : 2 points sur chaque texte.
PALIER = 200
# Le corps de tous les commentaires sous les graphiques des resultats.
CORPS_COMMENTAIRE = 1200
# Le retrait de depart d'une famille de zones (voir `famille`) : les
# resumes des journees, 16/22 au modele, sont a 14/20 sur toutes les pages.
STANDARDS = {'Espace réservé du contenu 2|2200': PALIER}

RE_FORME = re.compile(r'<p:sp>(?:(?!</p:sp>).)*?</p:sp>', re.S)
RE_CADRE = re.compile(r'<p:graphicFrame>(?:(?!</p:graphicFrame>).)*?</p:graphicFrame>', re.S)
RE_POSITION = re.compile(r'<a:off x="(\d+)" y="(\d+)"/>\s*<a:ext cx="(\d+)" cy="(\d+)"/>')
RE_PARAGRAPHE = re.compile(r'<a:p>(?:(?!</a:p>).)*?</a:p>', re.S)


def lignes_de(texte, par_ligne):
    """Le nombre de lignes d'un texte replie mot a mot."""
    n, courant = 1, 0
    for mot in texte.split():
        if courant and courant + 1 + len(mot) > par_ligne:
            n, courant = n + 1, len(mot)
        else:
            courant += (1 if courant else 0) + len(mot)
    return n


def hauteur_ligne(corps):
    """La hauteur d'une ligne de texte, en EMU, pour un corps en centiemes de point."""
    return corps / 100 * PT * INTERLIGNE


def lignes_texte(texte, largeur, corps, gras=False):
    """Le nombre de lignes d'un texte dans une largeur en EMU."""
    signe = corps / 100 * PT * (CHASSE_GRAS if gras else CHASSE)
    return lignes_de(texte, max(1, int(largeur / signe)))


def _attr(balise, nom, defaut=None):
    m = re.search(rf'\b{nom}="(-?\d+)"', balise or '')
    return int(m.group(1)) if m else defaut


def _niveaux(corps_xml):
    """Les reglages par niveau du `lstStyle` de la zone : marge, corps, espacements."""
    niveaux = {}
    style = re.search(r'<a:lstStyle>(.*?)</a:lstStyle>', corps_xml, re.S)
    for n, contenu in re.findall(r'<a:lvl(\d)pPr\b(.*?)</a:lvl\1pPr>', style.group(1) if style else '',
                                 re.S):
        niveaux[int(n) - 1] = _reglages(contenu)
    return niveaux


def _reglages(ppr):
    """Les reglages portes par un `pPr` (ou un niveau de `lstStyle`)."""
    r = {}
    tete = re.match(r'[^>]*', ppr).group(0)
    if _attr(tete, 'marL') is not None:
        r['marL'] = _attr(tete, 'marL')
    for cle in ('lnSpc', 'spcBef', 'spcAft'):
        m = re.search(rf'<a:{cle}>(.*?)</a:{cle}>', ppr, re.S)
        if m:
            r[cle] = (('pct', _attr(m.group(1), 'val')) if 'spcPct' in m.group(1)
                      else ('pts', _attr(m.group(1), 'val')))
    corps = re.search(r'<a:defRPr\b[^>]*', ppr)
    if corps and _attr(corps.group(0), 'sz'):
        r['sz'] = _attr(corps.group(0), 'sz')
    return r


def paragraphes(corps_xml):
    """Les paragraphes d'une zone : texte, corps, gras, marge et espacements."""
    niveaux = _niveaux(corps_xml)
    sortie = []
    for p in RE_PARAGRAPHE.findall(corps_xml.split('</a:lstStyle>')[-1]):
        ppr = re.search(r'<a:pPr\b[^>]*?(?:/>|>.*?</a:pPr>)', p, re.S)
        ppr = ppr.group(0) if ppr else ''
        niveau = _attr(ppr, 'lvl', 0)
        r = dict(niveaux.get(niveau, {}))
        r.update({c: v for c, v in _reglages(ppr[len('<a:pPr'):]).items() if c != 'sz'})
        texte = ''.join(re.findall(r'<a:t>([^<]*)</a:t>', p))
        runs = re.findall(r'<a:rPr\b[^>]*', p) if texte.strip() else []
        runs = runs or re.findall(r'<a:endParaRPr\b[^>]*', p)
        tailles = [_attr(run, 'sz') for run in runs if _attr(run, 'sz')]
        corps = max(tailles) if tailles else r.get('sz', 1800)
        gras = any(_attr(run, 'b') == 1 for run in runs)
        sortie.append({**r, 'texte': texte, 'sz': corps, 'gras': gras})
    return sortie


def hauteur_paragraphes(paras, largeur, echelle=1.0, reduction=0, retrait=0):
    """La hauteur qu'occupent ces paragraphes, a `echelle` de leur corps.

    `reduction` est le resserrement d'interligne que la zone porte deja
    (`lnSpcReduction`, en millemes de pourcent) : PowerPoint l'applique.
    `retrait` (centiemes de point) est ote du corps de chaque paragraphe,
    `echelle` ne reglant alors que les espacements.
    """
    total = 0
    for p in paras:
        corps = max(CORPS_MIN, p['sz'] * (1 if retrait else echelle) - retrait)
        n = lignes_texte(p['texte'], largeur - p.get('marL', 0), corps, p['gras']) \
            if p['texte'].strip() else 1
        sorte, val = p.get('lnSpc', ('pct', 100000))
        ligne = hauteur_ligne(corps) * ((val - reduction) / 100000 if sorte == 'pct' else 1)
        if sorte == 'pts':
            ligne = val / 100 * PT * echelle
        espaces = sum(v / 100 * PT * echelle for s, v in
                      (p.get('spcBef', ('pts', 0)), p.get('spcAft', ('pts', 0))) if s == 'pts')
        total += n * ligne + espaces
    return total


def _marges(body):
    return (_attr(body, 'lIns', 91440) + _attr(body, 'rIns', 91440),
            _attr(body, 'tIns', 45720) + _attr(body, 'bIns', 45720))


def arrondi(corps):
    """Un corps au point entier inferieur : l'estimation reste valable."""
    return max(CORPS_MIN, int(corps // 100) * 100)


def mettre_a_l_echelle(corps_xml, echelle, retrait=0):
    """Ecrit en clair le corps de chaque texte, reduit a `echelle`, et ses espacements.

    Avec `retrait`, chaque corps perd ce nombre de centiemes de point et
    `echelle` ne regle que les espacements.
    """
    tete, _, suite = corps_xml.rpartition('</a:lstStyle>')
    if not _:
        tete, suite = '', corps_xml
    paras = paragraphes(corps_xml)
    morceaux = RE_PARAGRAPHE.split(suite)
    trouves = RE_PARAGRAPHE.findall(suite)

    def sur_run(m, defaut):
        balise = m.group(0)
        sz = _attr(balise, 'sz') or defaut
        corps = arrondi(sz - retrait if retrait else sz * echelle)
        if _attr(balise, 'sz'):
            return re.sub(r'\bsz="\d+"', f'sz="{corps}"', balise, count=1)
        return balise.replace(m.group(1), f'{m.group(1)} sz="{corps}"', 1)

    sortie = [morceaux[0]]
    for p, info, apres in zip(trouves, paras, morceaux[1:]):
        p = re.sub(r'(<a:(?:rPr|endParaRPr))\b[^>]*?(?=/?>)', lambda m: sur_run(m, info['sz']), p)
        p = re.sub(r'(<a:spcPts val=")(\d+)"',
                   lambda m: f'{m.group(1)}{round(int(m.group(2)) * echelle)}"', p)
        sortie.append(p + apres)
    tete = re.sub(r'(<a:spcPts val=")(\d+)"',
                  lambda m: f'{m.group(1)}{round(int(m.group(2)) * echelle)}"', tete)
    return (tete + '</a:lstStyle>' if tete else '') + ''.join(sortie)


def _position(forme):
    m = RE_POSITION.search(forme)
    return tuple(int(v) for v in m.groups()) if m else None


def _deplacer(forme, x, y, cx, cy):
    return RE_POSITION.sub(f'<a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/>', forme, count=1)


def _corps(forme):
    m = re.search(r'<p:txBody>(.*)</p:txBody>', forme, re.S)
    return m


def _mesures(forme):
    """Position (bornee a la limite), paragraphes, largeur et hauteur utiles, resserrement."""
    pos = _position(forme)
    corps = _corps(forme)
    if not pos or not corps or not re.search(r'<a:t>[^<]*\S', corps.group(1)):
        return None
    x, y, cx, cy = pos
    if y >= LIMITE_BAS:
        return None
    cy = min(cy, LIMITE_BAS - y)
    mh, mv = _marges(re.search(r'<a:bodyPr\b[^>]*', forme).group(0))
    reduction = _attr(re.search(r'<a:normAutofit\b[^>]*', forme).group(0), 'lnSpcReduction', 0)
    return (x, y, cx, cy), paragraphes(corps.group(1)), cx - mh, cy - mv, reduction


def _echelle(paras, retrait):
    plus_grand = max(p['sz'] for p in paras)
    return max(CORPS_MIN, plus_grand - retrait) / plus_grand


def famille(forme):
    """Les zones qui portent la meme taille dans tout le rapport : meme nom, meme plus grand corps
    au modele (les resumes des journees, par exemple)."""
    nom = re.search(r'<p:cNvPr [^>]*name="([^"]*)"', forme)
    corps = _corps(forme)
    if not nom or not corps:
        return None
    paras = paragraphes(corps.group(1))
    return f'{nom.group(1)}|{max(p["sz"] for p in paras)}' if paras else None


def retrait_requis(forme, minimum=0):
    """Ce qu'il faut oter au corps de chaque texte, par paliers de `PALIER`, pour tenir.

    Tous les paragraphes descendent ensemble : une zone n'a que quelques
    tailles possibles (16/22, 14/20, 12/18...), jamais un corps au plus juste.
    """
    mesures = _mesures(forme)
    if not mesures:
        return 0
    _, paras, largeur, place, reduction = mesures
    plus_grand = max(p['sz'] for p in paras)
    retrait = minimum
    while (hauteur_paragraphes(paras, largeur, _echelle(paras, retrait), reduction, retrait) > place
           and plus_grand - retrait > CORPS_MIN):
        retrait += PALIER
    return retrait


def ajuster_zone(forme, minimum=0):
    """Une zone « ajuster le texte » : corps reduit jusqu'a tenir, bas au-dessus des logos.

    `minimum` est le retrait que la famille de la zone porte dans le
    rapport (voir `besoins`) : la zone ne prend jamais un corps plus grand.
    """
    mesures = _mesures(forme)
    if not mesures:
        return forme
    (x, y, cx, cy), paras, _, _, reduction = mesures
    if (x, y, cx, cy) != _position(forme):
        forme = _deplacer(forme, x, y, cx, cy)
    retrait = retrait_requis(forme, minimum)
    if not retrait:
        return forme
    echelle = _echelle(paras, retrait)
    corps = _corps(forme)
    forme = (forme[:corps.start(1)] + mettre_a_l_echelle(corps.group(1), echelle, retrait)
             + forme[corps.end(1):])
    # Le corps est maintenant ecrit en clair : plus de reduction de police
    # a appliquer par-dessus ; le resserrement d'interligne reste.
    return re.sub(r'<a:normAutofit\b[^>]*/>', f'<a:normAutofit lnSpcReduction="{reduction}"/>'
                  if reduction else '<a:normAutofit/>', forme)


def ajuster_cadre_auto(forme):
    """Une zone qui s'agrandit avec son texte (commentaire sous un graphique).

    Un commentaire (« Rectangle » du modele) prend `CORPS_COMMENTAIRE`
    sur toutes les pages. Une autre zone ne change pas tant qu'elle
    tient au-dessus de la limite. Sinon le texte descend point par point
    jusqu'a 12, puis la zone remonte un peu sur le graphique, enfin le
    texte diminue encore. Une zone que le modele place deja plus bas
    (couverture, fiches) est laissee.
    """
    pos = _position(forme)
    corps = _corps(forme)
    if not pos or not corps or not re.search(r'<a:t>[^<]*\S', corps.group(1)):
        return forme
    x, y, cx, cy = pos
    if y + cy > LIMITE_BAS:
        return forme
    body = re.search(r'<a:bodyPr\b[^>]*', forme).group(0)
    mh, mv = _marges(body)
    paras = paragraphes(corps.group(1))
    plus_grand = max(p['sz'] for p in paras)
    depart = plus_grand
    if re.search(r'<p:cNvPr [^>]*name="Rectangle', forme):
        depart = min(plus_grand, CORPS_COMMENTAIRE)

    def besoin(echelle):
        return round(hauteur_paragraphes(paras, cx - mh, echelle) + mv)

    if depart == plus_grand and y + besoin(1.0) <= LIMITE_BAS:
        return forme
    points = depart // 100
    essais = [(p, y) for p in range(points, min(points, 12) - 1, -1)]
    essais += [(p, y - REMONTEE_MAX) for p in range(min(points, 12), CORPS_MIN // 100 - 1, -1)]
    for p, plafond in essais:
        echelle = p * 100 / plus_grand
        if plafond + besoin(echelle) <= LIMITE_BAS:
            break
    haut = max(y - REMONTEE_MAX, min(y, LIMITE_BAS - besoin(echelle)))
    if echelle != 1.0:
        forme = (forme[:corps.start(1)] + mettre_a_l_echelle(corps.group(1), echelle)
                 + forme[corps.end(1):])
    return _deplacer(forme, x, haut, cx, besoin(echelle))


def ajuster_tableau(cadre):
    """Un tableau qui descend sous la limite cede la difference a sa derniere ligne."""
    pos = _position(cadre)
    if not pos or '<a:tbl>' not in cadre:
        return cadre
    x, y, cx, cy = pos
    lignes = [int(h) for h in re.findall(r'<a:tr h="(\d+)"', cadre)]
    if not lignes:
        return cadre
    hauteur = max(cy, sum(lignes))
    exces = y + hauteur - LIMITE_BAS
    if exces <= 0 or exces > lignes[-1] / 2:
        return cadre
    dernier = list(re.finditer(r'<a:tr h="(\d+)"', cadre))[-1]
    cadre = (cadre[:dernier.start(1)] + str(lignes[-1] - exces) + cadre[dernier.end(1):])
    return _deplacer(cadre, x, y, cx, hauteur - exces)


def retirer_pieds(xml):
    """Le pied de page des dispositions n'a pas sa place dans le rapport."""
    return RE_FORME.sub(lambda m: '' if '<p:ph type="ftr"' in m.group(0) else m.group(0), xml)


def _zones(xml):
    """Les zones « ajuster le texte » que la mise en page regle (hors legendes et reperes)."""
    for forme in RE_FORME.findall(xml):
        if '<a:normAutofit' in forme and not re.search(
                r'<p:ph type="(?:sldNum|dt|ftr)"|name="Legende', forme):
            yield forme


def besoins(xml):
    """Le retrait que chaque famille de zones de cette diapositive demande pour tenir.

    Le rapport retient, pour chaque famille, le plus fort retrait de
    toutes ses pages : les resumes des journees gardent la meme taille
    d'un jour a l'autre.
    """
    sortie = {}
    for forme in _zones(xml):
        cle = famille(forme)
        if cle:
            besoin = retrait_requis(forme, STANDARDS.get(cle, 0))
            sortie[cle] = max(sortie.get(cle, 0), besoin)
    return sortie


def ajuster(xml, imposes=None):
    """La mise en page finale d'une diapositive remplie (voir le module).

    `imposes` donne le retrait de chaque famille de zones, commun a tout
    le rapport (voir `besoins`).
    """
    imposes = imposes or {}
    xml = retirer_pieds(xml)

    def sur_forme(m):
        forme = m.group(0)
        # Les legendes des photos sont mises en page avec elles (photos.py).
        if re.search(r'<p:ph type="(?:sldNum|dt|ftr)"|name="Legende', forme):
            return forme
        if '<a:spAutoFit/>' in forme:
            return ajuster_cadre_auto(forme)
        if '<a:normAutofit' in forme:
            cle = famille(forme)
            return ajuster_zone(forme, max(imposes.get(cle, 0), STANDARDS.get(cle, 0)))
        return forme
    xml = RE_FORME.sub(sur_forme, xml)
    return RE_CADRE.sub(lambda m: ajuster_tableau(m.group(0)), xml)


def numeroter(xml, numero):
    """Le numero de page affiche tant que PowerPoint ne l'a pas recalcule."""
    return re.sub(r'(<a:fld\b[^>]*type="slidenum"[^>]*>.*?<a:t>)\d*(</a:t>)',
                  lambda m: f'{m.group(1)}{numero}{m.group(2)}', xml, flags=re.S)
