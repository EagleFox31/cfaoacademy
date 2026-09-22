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
import json
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

from composer import composer
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
    """
    nus = {c.strip().casefold(): v for c, v in valeurs.items()
           if not c.startswith('{') and v}

    def sur_run(m):
        texte = m.group(1)
        for drapeau, valeur in valeurs.items():
            if drapeau.startswith('{') and drapeau in texte:
                texte = texte.replace(drapeau, str(valeur))
        remplacement = nus.get(texte.strip().casefold())
        if remplacement:
            texte = str(remplacement)
        return '<a:t>' + texte + '</a:t>'

    return re.sub(r'<a:t>(.*?)</a:t>', sur_run, xml, flags=re.S)


def remplir(source, cible, valeurs):
    """Ecrit une copie du PPTX dont les drapeaux portent les valeurs."""
    with zipfile.ZipFile(source) as z:
        infos = {i.filename: i for i in z.infolist()}
        contenus = {n: z.read(n) for n in infos}

    for nom in contenus:
        if re.match(r'ppt/slides/slide\d+\.xml$', nom):
            xml = contenus[nom].decode('utf-8')
            contenus[nom] = substituer(xml, valeurs).encode('utf-8')

    with zipfile.ZipFile(cible, 'w', zipfile.ZIP_DEFLATED) as out:
        for nom, donnees in contenus.items():
            zi = zipfile.ZipInfo(nom, date_time=infos[nom].date_time)
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
        remplir(MODELE, rempli, valeurs)
        seule = travail / 'seule.pptx'
        composer(str(rempli), str(seule), [diapo])
        png = convertir(seule, travail, 'png')
        shutil.move(str(png), cible)
        return cible
    finally:
        shutil.rmtree(travail, ignore_errors=True)


def document(parties, valeurs, nb_jours=0, nb_participants=0, format_='pptx'):
    """Le rapport complet, limite aux parties retenues."""
    numeros = diapos_pour(parties, nb_jours, nb_participants)
    travail = Path(tempfile.mkdtemp(prefix='cr-doc-'))
    try:
        rempli = travail / 'rempli.pptx'
        remplir(MODELE, rempli, valeurs)
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
