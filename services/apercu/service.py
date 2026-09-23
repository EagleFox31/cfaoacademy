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


def repeter_lignes(xml, tableaux):
    """Repete la ligne de tableau d'un drapeau, une fois par element.

    `tableaux` associe le drapeau qui designe la ligne porteuse — par
    exemple `{stagiaire_nom}` — a la liste des lignes a produire, chacune
    donnant la valeur de chaque drapeau de la ligne.

    Le cadre du tableau, tel que le modele le dessine, est la place dont
    il dispose. Une liste qui ne tient pas a hauteur normale resserre ses
    lignes et reduit sa police dans la meme proportion, plutot que de
    deborder de la page. Une liste vide laisse la ligne porteuse en
    place, comme toute donnee manquante.
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
            place = int(cadre.group(2))
            hauteur = min(h, max(1, (place - autres) // len(lignes)))
            echelle = hauteur / h

            def taille(m, echelle=echelle):
                return f'sz="{max(700, round(int(m.group(1)) * echelle))}"'

            modele = porteuse.group(0).replace(f'h="{h}"', f'h="{hauteur}"', 1)
            if echelle < 1:
                modele = re.sub(r'sz="(\d+)"', taille, modele)
                # Les marges hautes et basses de la cellule (0,05 pouce
                # par defaut) fixent une hauteur minimale : elles se
                # resserrent avec le reste.
                marge = round(45720 * echelle * echelle)
                modele = modele.replace(
                    '<a:tcPr ', f'<a:tcPr marT="{marge}" marB="{marge}" ')
            copies = []
            for ligne in lignes:
                copie = modele
                for drapeau, valeur in ligne.items():
                    copie = copie.replace(drapeau, echapper(valeur))
                copies.append(copie)
            bloc = (bloc[:porteuse.start()] + ''.join(copies)
                    + bloc[porteuse.end():])
            # Le cadre epouse le tableau produit : PowerPoint s'en sert
            # pour la poignee de selection.
            total = autres + hauteur * len(lignes)
            bloc = RE_CADRE_TABLEAU.sub(
                lambda m: m.group(1) + str(total) + m.group(3) + m.group(4),
                bloc, count=1)
            xml = xml[:cadre.start()] + bloc + xml[cadre.end():]
            break
    return xml


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
    xml = repeter_lignes(xml, valeurs.get('@lignes') or {})
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
        if isinstance(contenu, dict):
            photos.poser_nommes(contenus, slide, contenu, CACHE)
        else:
            photos.poser(contenus, slide, contenu, CACHE)

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
    """Convertit un PPTX via LibreOffice et renvoie le fichier produit."""
    subprocess.run(
        [SOFFICE, '--headless', '--norestore',
         f'-env:UserInstallation={PROFIL}',
         '--convert-to', format_, '--outdir', str(dossier), str(pptx)],
        capture_output=True, timeout=120)
    produits = list(Path(dossier).glob(f'*.{format_}'))
    if not produits:
        raise RuntimeError(f'conversion {format_} sans resultat')
    return produits[0]


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
            final = CACHE / 'rapport.pptx'
            CACHE.mkdir(parents=True, exist_ok=True)
            shutil.move(str(sortie), final)
            return final
        pdf = convertir(sortie, travail, 'pdf')
        final = CACHE / 'rapport.pdf'
        CACHE.mkdir(parents=True, exist_ok=True)
        shutil.move(str(pdf), final)
        return final
    finally:
        shutil.rmtree(travail, ignore_errors=True)
