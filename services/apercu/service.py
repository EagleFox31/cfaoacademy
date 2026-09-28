# -*- coding: utf-8 -*-
"""Service d'apercu : rend en image une diapositive du compte rendu.

L'assistant montre au formateur la page telle qu'elle sortira de
PowerPoint, pas une reconstitution HTML. La chaine est donc reelle :
le modele est rempli, reduit a la diapositive voulue, puis converti.

Le cout tient au chargement du document, pas au rendu : le modele
embarque onze masques et 572 mises en page pour vingt-huit
diapositives, que LibreOffice analyse a chaque ouverture. `composer`
ne conserve que les parties atteignables depuis la diapositive
demandee, ce qui ramene la conversion d'une vingtaine de secondes a
environ une seconde.

Chaque image est mise en cache sous l'empreinte de son contenu : tant
que les valeurs d'une diapositive ne changent pas, elle n'est pas
reconvertie.
"""

import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import uuid
import zipfile
from pathlib import Path

from composer import composer
import blocs
import classeurs
import photos
from modele import diapos_pour

RACINE = Path(__file__).resolve().parent
MODELE = Path(os.environ.get(
    'CR_MODELE',
    RACINE / 'modeles' / 'MODELE-REFERENCES.pptx'))
CACHE = Path(os.environ.get('CR_CACHE', RACINE / '.cache'))
SOFFICE = os.environ.get(
    'CR_SOFFICE', r'C:\Program Files\LibreOffice\program\soffice.exe')

# Un profil dedie : LibreOffice refuse deux instances sur le meme profil.
PROFIL = (RACINE / '.profil-lo').as_uri().replace('file:///', 'file:///')


# Un champ que le formateur laisse vide a dessein. Il faut un mot, et
# non une chaine vide, pour le distinguer d'une donnee pas encore
# saisie : les deux se ressemblent sinon.
VIDE = '∅'


def echapper(valeur):
    """Une valeur saisie, rendue sure pour le XML du document.

    Un « & » ou un « < » tape par le formateur casserait la diapositive
    entiere, que LibreOffice refuserait alors d'ouvrir.
    """
    return html.escape(str(valeur), quote=False)


# L'espacement que le modele laisse avant un paragraphe.
RE_ESPACE_AVANT = re.compile(r'<a:spcBef>.*?</a:spcBef>', re.S)
RE_POINTS = re.compile(r'(<a:spcBef><a:spcPts val=")(\d+)(")')


RE_PARAGRAPHE = re.compile(r'<a:p>(?:(?!</a:p>).)*?</a:p>', re.S)


def _lignes(elements):
    """Les elements d'une liste a plat : (niveau, texte), vides ecartes.

    Un element est un texte, ou un groupe `{'texte': ..., 'sous': [...]}`
    dont le titre ouvre la marche et dont les sous-elements suivent.
    """
    lignes = []
    for e in elements:
        if isinstance(e, dict):
            if str(e.get('texte', '')).strip():
                lignes.append((0, e['texte']))
            lignes += [(1, s) for s in e.get('sous') or [] if str(s).strip()]
        elif str(e).strip():
            lignes.append((0, e))
    return lignes


def repeter(xml, listes):
    """Repete le paragraphe d'un drapeau de liste, une fois par element.

    Le nombre de lignes d'une liste varie d'une session a l'autre ; le
    modele n'en porte qu'une, le paragraphe `{objectif_1}` par exemple.
    On le duplique avec sa mise en forme, chaque copie recevant son
    element.

    Une liste a deux niveaux — des titres et leurs sous-elements — prend
    ses sous-elements dans un second paragraphe porteur, dont le drapeau
    prefixe le premier de `sous_` : `{sous_objectif_1}`. Une diapositive
    qui n'en porte pas pose tout au premier niveau.

    L'espacement avant le paragraphe separe les lignes entre elles : la
    premiere n'en a pas besoin. Au-dela, l'espace total reste celui que
    le modele prevoyait pour ses quatre lignes, partage entre toutes :
    une liste plus longue se resserre au lieu de deborder de son cadre.

    Une liste vide laisse le drapeau en place, comme toute donnee
    manquante.
    """
    for drapeau, elements in listes.items():
        lignes = _lignes(elements)
        if not lignes:
            continue
        sous = '{sous_' + drapeau[1:]
        porteurs = {}
        for m in RE_PARAGRAPHE.finditer(xml):
            for niveau, d in ((0, drapeau), (1, sous)):
                if d in m.group(0) and niveau not in porteurs:
                    porteurs[niveau] = (m.group(0), d)
        if 0 not in porteurs:
            continue
        facteur = min(1, 3 / max(len(lignes) - 1, 1))

        def resserre(p, facteur=facteur):
            points = round(int(p.group(2)) * facteur)
            return p.group(1) + str(points) + p.group(3)

        copies = []
        for i, (niveau, texte) in enumerate(lignes):
            modele, d = porteurs.get(niveau, porteurs[0])
            p = (RE_ESPACE_AVANT.sub('', modele) if i == 0
                 else RE_POINTS.sub(resserre, modele))
            copies.append(p.replace(d, echapper(texte)))

        # Le premier porteur recoit toute la liste, le second s'efface :
        # ses copies sont deja rangees sous leurs titres.
        def sur_paragraphe(m, drapeau=drapeau, sous=sous, copies=copies):
            if drapeau in m.group(0):
                return ''.join(copies)
            if sous in m.group(0):
                return ''
            return m.group(0)

        xml = RE_PARAGRAPHE.sub(sur_paragraphe, xml)
    return xml


RE_LIGNE = re.compile(r'<a:tr [^>]*>(?:(?!</a:tr>).)*?</a:tr>', re.S)
RE_CADRE_TABLEAU = re.compile(
    r'(<p:graphicFrame>(?:(?!</p:graphicFrame>).)*?<a:ext cx="\d+" cy=")(\d+)(")'
    r'((?:(?!</p:graphicFrame>).)*?</p:graphicFrame>)', re.S)


def retirer_lignes(xml, ancres):
    """Retire les lignes de tableau qui portent l'un des drapeaux `ancres`.

    Le modele dessine parfois plusieurs lignes numerotees la ou le
    document en veut un nombre variable (les six modules de la fiche de
    certification) : on retire les lignes 2 a n, et `repeter_lignes`
    repete la premiere autant de fois qu'il faut, dans la place liberee.
    """
    if not ancres:
        return xml
    return RE_LIGNE.sub(
        lambda m: '' if any(a in m.group(0) for a in ancres) else m.group(0), xml)


RE_FORME = re.compile(
    r'<p:(sp|pic|graphicFrame|cxnSp)>(?:(?!</p:\1>).)*?'
    r'<a:off x="(\d+)" y="(\d+)"/>\s*<a:ext cx="(\d+)" cy="(\d+)"/>', re.S)
# L'ecart garde entre un tableau agrandi et la forme qui le suit.
ECART_SOUS_TABLEAU = 137160


def place_libre(xml, cadre):
    """La hauteur dont un tableau dispose en descendant jusqu'a la forme suivante.

    Le cadre dessine par le modele est la place minimale. Sous lui, la
    premiere forme qui partage sa largeur fixe la limite ; sans forme
    dessous, le cadre garde sa hauteur.
    """
    x, y, cx, cy = (int(v) for v in re.search(
        r'<a:off x="(\d+)" y="(\d+)"/>\s*<a:ext cx="(\d+)" cy="(\d+)"/>', cadre).groups())
    limites = [int(m.group(3)) for m in RE_FORME.finditer(xml)
               if int(m.group(3)) >= y + cy
               and int(m.group(2)) < x + cx and int(m.group(2)) + int(m.group(4)) > x]
    return max(cy, min(limites) - y - ECART_SOUS_TABLEAU) if limites else cy


def marges(tcpr, marge):
    """Les marges haute et basse d'une cellule, remplacees si le modele les fixe deja."""
    tcpr = re.sub(r' mar[TB]="\d+"', '', tcpr)
    return tcpr.replace('<a:tcPr', f'<a:tcPr marT="{marge}" marB="{marge}"', 1)


# La largeur moyenne d'un caractere, en fraction du corps (Arial gras).
CHASSE = 0.55
INTERLIGNE = 1.2


def lignes_de(texte, par_ligne):
    """Le nombre de lignes d'un texte replie mot a mot."""
    n, courant = 1, 0
    for mot in texte.split():
        if courant and courant + 1 + len(mot) > par_ligne:
            n, courant = n + 1, len(mot)
        else:
            courant += (1 if courant else 0) + len(mot)
    return n


def hauteur_utile(ligne, colonnes, h):
    """La hauteur que prendra une ligne remplie, ses textes longs replies.

    PowerPoint agrandit une ligne dont un texte passe a la ligne : un
    intitule de module sur deux lignes double sa case. On compte les
    lignes de chaque case d'apres sa largeur et son corps.
    """
    besoin = h
    for tc, largeur in zip(re.findall(r'<a:tc\b.*?</a:tc>', ligne, re.S), colonnes):
        texte = ''.join(re.findall(r'<a:t>([^<]*)</a:t>', tc))
        if not texte:
            continue
        sz = re.search(r'sz="(\d+)"', tc)
        corps = (int(sz.group(1)) if sz else 1800) / 100 * 12700
        marges_h = sum(int(v) for v in re.findall(r'mar[LR]="(\d+)"', tc)) or 182880
        marges_v = sum(int(v) for v in re.findall(r'mar[TB]="(\d+)"', tc)) or 91440
        par_ligne = max(1, int((largeur - marges_h) / (corps * CHASSE)))
        n = lignes_de(texte, par_ligne)
        # Sur une ligne, la hauteur du modele fait foi.
        if n > 1:
            besoin = max(besoin, round(n * corps * INTERLIGNE + marges_v))
    return besoin


def repeter_lignes(xml, tableaux, etendre=()):
    """Repete la ligne de tableau d'un drapeau, une fois par element.

    `tableaux` associe le drapeau qui designe la ligne porteuse — par
    exemple `{stagiaire_nom}` — a la liste des lignes a produire, chacune
    donnant la valeur de chaque drapeau de la ligne.

    Le cadre du tableau, tel que le modele le dessine, est la place dont
    il dispose. Une liste qui ne tient pas a hauteur normale resserre ses
    lignes et reduit sa police dans la meme proportion, plutot que de
    deborder de la page. Une liste vide laisse la ligne porteuse en
    place, comme toute donnee manquante.

    Un drapeau de `etendre` peut d'abord descendre dans l'espace libre
    sous le cadre : les treize modules d'une certification tiennent a
    taille normale la ou le modele n'en dessine que six.
    """
    for ancre, lignes in tableaux.items():
        lignes = [l for l in lignes or [] if isinstance(l, dict)]
        if not lignes:
            continue
        for cadre in RE_CADRE_TABLEAU.finditer(xml):
            if ancre not in cadre.group(0):
                continue
            bloc = cadre.group(0)
            porteuse = next(m for m in RE_LIGNE.finditer(bloc)
                            if ancre in m.group(0))
            h = int(re.search(r'h="(\d+)"', porteuse.group(0)).group(1))
            autres = sum(int(v) for m in RE_LIGNE.finditer(bloc)
                         if m.start() != porteuse.start()
                         for v in re.findall(r'<a:tr h="(\d+)"', m.group(0)))
            place = (place_libre(xml, bloc) if ancre in etendre
                     else int(cadre.group(2)))
            colonnes = [int(w) for w in re.findall(r'<a:gridCol w="(\d+)"', bloc)]
            remplies = []
            for ligne in lignes:
                # Une ligne peut porter son propre code couleur (une note
                # sous le seuil), pose avant que ses drapeaux disparaissent.
                copie = colorer(porteuse.group(0), ligne.get('@couleurs'))
                for drapeau, valeur in ligne.items():
                    if not drapeau.startswith('@'):
                        copie = copie.replace(drapeau, echapper(valeur))
                remplies.append((copie, hauteur_utile(copie, colonnes, h)))
            besoin = sum(b for _, b in remplies)
            echelle = min(1, max(1, place - autres) / besoin)

            def taille(m):
                return f'sz="{max(700, round(int(m.group(1)) * echelle))}"'

            def resserrer(m):
                # Les marges hautes et basses de la cellule (0,05 pouce
                # par defaut) fixent une hauteur minimale : elles se
                # resserrent avec le reste.
                tcpr = m.group(0)
                fixee = re.search(r' marT="(\d+)"', tcpr)
                marge = int(fixee.group(1)) if fixee else 45720
                return marges(tcpr, round(marge * echelle * echelle))

            copies, total = [], autres
            for copie, b in remplies:
                hauteur = max(1, round(b * echelle))
                copie = copie.replace(f'h="{h}"', f'h="{hauteur}"', 1)
                if echelle < 1:
                    copie = re.sub(r'sz="(\d+)"', taille, copie)
                    copie = re.sub(r'<a:tcPr\b[^>]*', resserrer, copie)
                copies.append(copie)
                total += hauteur
            bloc = (bloc[:porteuse.start()] + ''.join(copies)
                    + bloc[porteuse.end():])
            # Le cadre epouse le tableau produit : PowerPoint s'en sert
            # pour la poignee de selection.
            bloc = RE_CADRE_TABLEAU.sub(
                lambda m: m.group(1) + str(total) + m.group(3) + m.group(4),
                bloc, count=1)
            xml = xml[:cadre.start()] + bloc + xml[cadre.end():]
            break
    return xml


RE_PUCE = re.compile(r'<a:buFont\b[^>]*/><a:buChar\b[^>]*/>')
NUMEROS = '<a:buFont typeface="+mj-lt"/><a:buAutoNum type="romanUcPeriod"/>'


def marquer(xml, marquage):
    """Numerote les objectifs de la page a photos, comme les listes.

    Sur la page a photos (9), le paragraphe `{objectif_1}` porte une puce
    fixe. Le marquage choisi par le formateur s'y applique aussi :
    « romain » numerote chaque objectif (I., II., ...) ; « mixte »
    numerote les titres et garde la puce a leurs sous-objectifs, poses
    dans un second paragraphe `{sous_objectif_1}` en retrait, comme sur
    la page 8. Les pages de liste ont deja leur marquage : seul un
    paragraphe a puce est touche.
    """
    if marquage not in ('romain', 'mixte'):
        return xml
    for m in RE_PARAGRAPHE.finditer(xml):
        p = m.group(0)
        if '{objectif_1}' not in p or not RE_PUCE.search(p):
            continue
        # Un chiffre romain prend plus de place qu'une puce : le retrait
        # suit, pour que le texte s'aligne encore sous lui-meme.
        titre = re.sub(r'marL="\d+" indent="-\d+"', 'marL="257175" indent="-257175"',
                       RE_PUCE.sub(NUMEROS, p), count=1)
        if marquage == 'mixte':
            titre = titre.replace('b="0"', 'b="1"', 1)
            sous = re.sub(r'marL="\d+" indent="(-\d+)"',
                          lambda i: f'marL="{257175 + 171450}" lvl="1" indent="{i.group(1)}"', p, count=1)
            titre += sous.replace('{objectif_1}', '{sous_objectif_1}')
        return xml[:m.start()] + titre + xml[m.end():]
    return xml


def poser_photos(contenus, slide, contenu):
    """Les photos d'une diapositive, sous l'une des trois formes recues.

    Une liste suit une disposition (`[{id, x, y, l, h}]`) ; un objet a
    cle `photos` y ajoute le mode de legende (`{photos, legendes,
    commune}`) ; tout autre objet designe des emplacements par leur nom
    (`{'Emplacement groupe': {id}}`).
    """
    if isinstance(contenu, dict) and isinstance(contenu.get('photos'), list):
        photos.poser(contenus, slide, contenu['photos'], CACHE,
                     contenu.get('legendes'), contenu.get('commune') or '')
    elif isinstance(contenu, dict):
        photos.poser_nommes(contenus, slide, contenu, CACHE)
    else:
        photos.poser(contenus, slide, contenu, CACHE)


RE_FORME_OU_CASE = re.compile(r'<p:sp>(?:(?!</p:sp>).)*</p:sp>|<a:tc\b(?:(?!</a:tc>).)*</a:tc>', re.S)
# Le code couleur des rapports de certification : fond vert ou rouge pour
# les cases de resultat, texte vert ou rouge pour le statut e-learning.
# Le modele les porte en rouge brique (fond C0392B, texte A93226).
TEINTES = {
    'ok': {'C0392B': '92D050', 'A93226': '70AD47'},
    'ko': {'C0392B': 'FF0000', 'A93226': 'FF0000'},
    # Une note de module sous le seuil : sa case blanche passe au rouge.
    'alerte': {'FFFFFF': 'FF0000'},
}


def colorer(xml, couleurs):
    """Recolore les formes et les cases qui portent un drapeau de resultat.

    `couleurs` associe un drapeau (`{resultat_final}`) a `ok` ou `ko`.
    Seules les teintes rouges du modele changent : bordures et textes
    blancs restent tels quels.
    """
    if not couleurs:
        return xml

    def sur_element(m):
        el = m.group(0)
        for drapeau, sens in couleurs.items():
            if drapeau in el and sens in TEINTES:
                for avant, apres in TEINTES[sens].items():
                    el = el.replace(f'val="{avant}"', f'val="{apres}"')
        return el
    return RE_FORME_OU_CASE.sub(sur_element, xml)


RE_LIGNE_TABLEAU = re.compile(r'<a:tr\b(?:(?!</a:tr>).)*</a:tr>', re.S)


def ancrer_objectifs(xml):
    """Pose en haut de leur case les objectifs du tableau a photos (9).

    Le modele centre verticalement la ligne « Objectifs » : une liste
    courte flottait au milieu d'une grande case vide. Le libelle et la
    liste partent du haut, avec une petite marge.
    """
    def haut(m):
        tcpr = re.sub(r'\sanchor="\w+"', '', m.group(0))
        tcpr = re.sub(r'\smarT="\d+"', '', tcpr)
        return tcpr.replace('<a:tcPr', '<a:tcPr marT="144000" anchor="t"', 1)

    def sur_ligne(m):
        ligne = m.group(0)
        if '{objectif_1}' not in ligne:
            return ligne
        return re.sub(r'<a:tcPr\b[^>]*?(?=/?>)', haut, ligne)
    return RE_LIGNE_TABLEAU.sub(sur_ligne, xml)


def substituer(xml, valeurs):
    """Remplace les drapeaux dans le texte des runs.

    Deux formes coexistent dans le modele. La plupart des pages portent
    des drapeaux entre accolades (`{nom_complet}`), remplaces partout ou
    ils apparaissent. Les couvertures, elles, ont garde des mots nus
    (`Titre`, `lieu`, `PERIODE`) que l'anonymisation n'a pas encadres :
    ceux-la ne sont remplaces que si le run ne contient qu'eux, faute de
    quoi on toucherait un « lieu » au fil d'une phrase.

    Un drapeau sans valeur reste en place : une page ou il manque une
    donnee doit le montrer plutot que l'effacer discretement.

    Reste le cas d'un champ volontairement vide — un sous-titre de
    couverture dont le formateur ne veut pas. L'absence de valeur ne
    suffit pas a l'exprimer, puisqu'elle signifie deja « pas encore
    rempli ». La valeur `VIDE` le dit explicitement : le drapeau
    disparait au lieu de laisser le mot du modele s'imprimer.
    """
    xml = retirer_lignes(xml, valeurs.get('@retirer') or [])
    xml = marquer(xml, valeurs.get('@marquage'))
    xml = ancrer_objectifs(xml)
    xml = colorer(xml, valeurs.get('@couleurs'))
    xml = repeter_lignes(xml, valeurs.get('@lignes') or {},
                         valeurs.get('@etendre') or ())
    xml = repeter(xml, {c: v for c, v in valeurs.items() if isinstance(v, list)})
    valeurs = {c: v for c, v in valeurs.items()
               if isinstance(v, str) and not c.startswith('@')}
    nus = {c.strip().casefold(): v for c, v in valeurs.items()
           if not c.startswith('{') and (v or v == VIDE)}

    def sur_run(m):
        texte = m.group(1)
        for drapeau, valeur in valeurs.items():
            if drapeau.startswith('{') and drapeau in texte:
                texte = texte.replace(
                    drapeau, '' if valeur == VIDE else echapper(valeur))
        remplacement = nus.get(texte.strip().casefold())
        if remplacement:
            texte = '' if remplacement == VIDE else echapper(remplacement)
        return '<a:t>' + texte + '</a:t>'

    return re.sub(r'<a:t>(.*?)</a:t>', sur_run, xml, flags=re.S)


def remplir(source, cible, valeurs, diapos=None):
    """Ecrit une copie du PPTX dont les drapeaux portent les valeurs.

    `diapos` limite aux diapositives produites la mise a jour des
    classeurs embarques : chacun coute un passage par LibreOffice.
    """
    with zipfile.ZipFile(source) as z:
        infos = {i.filename: i for i in z.infolist()}
        contenus = {n: z.read(n) for n in infos}

    for nom in list(contenus):
        numero = re.match(r'ppt/slides/slide(\d+)\.xml$', nom)
        if numero:
            xml = contenus[nom].decode('utf-8')
            # Les blocs que le modele ne porte qu'une fois (le formateur)
            # se repetent avant la substitution des drapeaux communs.
            xml = blocs.repeter(xml, int(numero.group(1)), valeurs)
            contenus[nom] = substituer(xml, valeurs).encode('utf-8')

    # Les photos, par numero de diapositive. Une liste suit une
    # disposition (`{'9': [{id, x, y, l, h}]}`) ; un objet designe des
    # emplacements par leur nom (`{'4': {'Emplacement groupe': {id}}}`).
    for diapo, contenu in (valeurs.get('@photos') or {}).items():
        slide = f'ppt/slides/slide{int(diapo)}.xml'
        if slide not in contenus:
            continue
        poser_photos(contenus, slide, contenu)

    # Les tableaux et graphiques des resultats : classeurs embarques,
    # remplis puis redessines (voir `classeurs.py`).
    if diapos:
        classeurs.rafraichir(
            contenus, [f'ppt/slides/slide{int(n)}.xml' for n in sorted(set(diapos))],
            valeurs.get('@classeurs') or {}, SOFFICE, PROFIL, CACHE)

    with zipfile.ZipFile(cible, 'w', zipfile.ZIP_DEFLATED) as out:
        for nom, donnees in contenus.items():
            zi = zipfile.ZipInfo(
                nom, date_time=infos[nom].date_time if nom in infos
                else (2026, 1, 1, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            out.writestr(zi, donnees)


def empreinte(diapo, valeurs):
    """L'identite d'une image : sa diapositive et les valeurs qui s'y posent."""
    brut = json.dumps({'d': diapo, 'v': valeurs}, sort_keys=True,
                      ensure_ascii=False)
    return hashlib.sha1(brut.encode('utf-8')).hexdigest()[:16]


def convertir(pptx, dossier, format_='png'):
    """Convertit un PPTX via LibreOffice et renvoie le fichier produit.

    Sur un profil neuf (premier demarrage, conteneur recree), LibreOffice
    cree son profil puis s'arrete sans convertir : une seconde tentative
    suffit.
    """
    for _ in range(2):
        with classeurs.LIBREOFFICE:
            subprocess.run(
                [SOFFICE, '--headless', '--norestore',
                 f'-env:UserInstallation={PROFIL}',
                 '--convert-to', format_, '--outdir', str(dossier), str(pptx)],
                capture_output=True, timeout=120)
        produits = list(Path(dossier).glob(f'*.{format_}'))
        if produits:
            return produits[0]
    raise RuntimeError(f'conversion {format_} sans resultat')


def image_de(diapo, valeurs):
    """L'image d'une diapositive, depuis le cache ou fraichement produite."""
    CACHE.mkdir(parents=True, exist_ok=True)
    cible = CACHE / f'{empreinte(diapo, valeurs)}.png'
    if cible.exists():
        return cible

    travail = Path(tempfile.mkdtemp(prefix='cr-apercu-'))
    try:
        rempli = travail / 'rempli.pptx'
        remplir(MODELE, rempli, valeurs, [diapo])
        seule = travail / 'seule.pptx'
        composer(str(rempli), str(seule), [diapo])
        png = convertir(seule, travail, 'png')
        shutil.move(str(png), cible)
        return cible
    finally:
        shutil.rmtree(travail, ignore_errors=True)


def _fichier_rapport(extension):
    """Un fichier propre a cet export.

    Un nom fixe laissait deux formateurs exportant en meme temps
    s'ecraser l'un l'autre : chacun pouvait recevoir le rapport de
    l'autre. Les exports de plus d'une heure sont effaces au passage.
    """
    dossier = CACHE / 'rapports'
    dossier.mkdir(parents=True, exist_ok=True)
    for ancien in dossier.iterdir():
        try:
            if time.time() - ancien.stat().st_mtime > 3600:
                ancien.unlink()
        except OSError:
            pass
    return dossier / f'{uuid.uuid4().hex}.{extension}'


TYPE_DIAPO = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'
PREMIERE_COPIE = 1000


def _copier_diapo(contenus, numero, copie):
    """Ajoute au paquet la diapositive `copie`, reprise de `numero`.

    Les classeurs embarques sont copies avec elle : chaque page les
    remplit a sa facon (une fiche par stagiaire). Mises en page et
    images restent partagees, rien ne les modifie.
    """
    source = f'ppt/slides/slide{numero}.xml'
    nom = f'ppt/slides/slide{copie}.xml'
    rels_source = f'ppt/slides/_rels/slide{numero}.xml.rels'
    contenus[nom] = contenus[source]

    def copier_classeur(m):
        cible = m.group(2)
        if '/embeddings/' not in cible:
            return m.group(0)
        nouveau = f'../embeddings/copie{copie}_{cible.rsplit("/", 1)[1]}'
        contenus['ppt/' + nouveau[3:]] = contenus['ppt/' + cible.replace('../', '')]
        return m.group(1) + nouveau + '"'

    rels = contenus[rels_source].decode('utf-8')
    rels = re.sub(r'<Relationship [^>]*/notesSlide"[^>]*/>', '', rels)
    rels = re.sub(r'(<Relationship [^>]*Target=")([^"]+)"', copier_classeur, rels)
    contenus[f'ppt/slides/_rels/slide{copie}.xml.rels'] = rels.encode('utf-8')

    types = contenus['[Content_Types].xml'].decode('utf-8')
    contenus['[Content_Types].xml'] = types.replace(
        '</Types>', f'<Override PartName="/{nom}" ContentType="application/'
        'vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>').encode('utf-8')

    rid = f'rIdCopie{copie}'
    rels_pres = contenus['ppt/_rels/presentation.xml.rels'].decode('utf-8')
    contenus['ppt/_rels/presentation.xml.rels'] = rels_pres.replace(
        '</Relationships>', f'<Relationship Id="{rid}" Type="{TYPE_DIAPO}" '
        f'Target="slides/slide{copie}.xml"/></Relationships>').encode('utf-8')
    pres = contenus['ppt/presentation.xml'].decode('utf-8')
    ident = max(int(i) for i in re.findall(r'<p:sldId id="(\d+)"', pres)) + 1
    contenus['ppt/presentation.xml'] = pres.replace(
        '</p:sldIdLst>', f'<p:sldId id="{ident}" r:id="{rid}"/></p:sldIdLst>').encode('utf-8')


def rapport(pages, format_='pptx'):
    """Le rapport complet, tel que le formateur l'a vu page par page.

    `pages` : `[{diapo, valeurs}]`, dans l'ordre du rapport — les memes
    que pour l'apercu de chaque page. Une diapositive du modele sert
    plusieurs pages (un jour, une fiche par stagiaire) : chaque page en
    recoit une copie, remplie de ses propres valeurs.
    """
    with zipfile.ZipFile(MODELE) as z:
        contenus = {n: z.read(n) for n in z.namelist()}

    copies, a_rafraichir = [], []
    for rang, page in enumerate(pages):
        numero, valeurs = int(page['diapo']), page.get('valeurs') or {}
        copie = PREMIERE_COPIE + rang
        _copier_diapo(contenus, numero, copie)
        nom = f'ppt/slides/slide{copie}.xml'
        xml = blocs.repeter(contenus[nom].decode('utf-8'), numero, valeurs)
        contenus[nom] = substituer(xml, valeurs).encode('utf-8')
        poses = (valeurs.get('@photos') or {}).get(str(numero))
        if poses:
            poser_photos(contenus, nom, poses)
        a_rafraichir.append((nom, valeurs.get('@classeurs') or {}))
        copies.append(copie)
    # Les graphiques de toutes les pages, en un seul passage.
    classeurs.rafraichir_pages(contenus, a_rafraichir, SOFFICE, PROFIL, CACHE)

    travail = Path(tempfile.mkdtemp(prefix='cr-rapport-'))
    try:
        rempli = travail / 'rempli.pptx'
        with zipfile.ZipFile(rempli, 'w', zipfile.ZIP_DEFLATED) as out:
            for nom, donnees in contenus.items():
                out.writestr(nom, donnees)
        sortie = travail / 'rapport.pptx'
        composer(str(rempli), str(sortie), copies)
        if format_ != 'pptx':
            sortie = convertir(sortie, travail, 'pdf')
        final = _fichier_rapport(format_ if format_ == 'pdf' else 'pptx')
        shutil.move(str(sortie), final)
        return final
    finally:
        shutil.rmtree(travail, ignore_errors=True)


def document(parties, valeurs, nb_jours=0, nb_participants=0, format_='pptx',
             variantes=None):
    """Le rapport complet, limite aux parties retenues."""
    numeros = diapos_pour(parties, nb_jours, nb_participants, variantes)
    travail = Path(tempfile.mkdtemp(prefix='cr-doc-'))
    try:
        rempli = travail / 'rempli.pptx'
        remplir(MODELE, rempli, valeurs, numeros)
        sortie = travail / 'rapport.pptx'
        composer(str(rempli), str(sortie), numeros)
        if format_ == 'pptx':
            final = _fichier_rapport('pptx')
            shutil.move(str(sortie), final)
            return final
        pdf = convertir(sortie, travail, 'pdf')
        final = _fichier_rapport('pdf')
        shutil.move(str(pdf), final)
        return final
    finally:
        shutil.rmtree(travail, ignore_errors=True)
