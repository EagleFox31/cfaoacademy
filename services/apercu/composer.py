"""Produit un PPTX ne contenant que les diapositives demandees.

Sert aux deux besoins de l'apercu :

  - une seule diapositive, pour regenerer l'image apres une
    modification ;
  - la liste des diapositives retenues, pour le rapport final.

Le modele etant un empilement de presentations importees (onze masques,
572 mises en page), on ne garde que ce qui est atteignable depuis les
diapositives voulues, masques purges de leurs mises en page inutiles.
"""

import re
import sys
import zipfile
from pathlib import PurePosixPath

from alleger import (SOCLE, RE_CIBLE, RE_RELATION, cibles, elaguer_master,
                     elaguer_presentation, elaguer_rels, elaguer_types,
                     layouts_utiles, normaliser, rels_de, resoudre)


def _atteignables(zf, depart, masters_elagues):
    """Fermeture transitive, en lisant les masques deja purges."""
    vus, pile = set(), list(depart)
    while pile:
        partie = pile.pop()
        if partie in vus or partie not in zf.namelist():
            continue
        vus.add(partie)
        rels = rels_de(partie)
        if rels in zf.namelist():
            vus.add(rels)
        if partie in masters_elagues:
            # Suivre les seules relations encore citees par le masque.
            xml = masters_elagues[partie]
            vivants = set(re.findall(r'r:id="([^"]+)"', xml))
            for relation in RE_RELATION.findall(zf.read(rels).decode('utf-8')):
                m_id = re.search(r'Id="([^"]+)"', relation)
                m_c = RE_CIBLE.search(relation)
                if not (m_id and m_c):
                    continue
                cible = normaliser(resoudre(partie, m_c.group(1)))
                if 'slideLayout' in cible and m_id.group(1) not in vivants:
                    continue
                pile.append(cible)
        else:
            pile.extend(cibles(zf, partie))
    return vus


def composer(source, destination, numeros):
    """Ecrit dans `destination` un PPTX limite aux diapositives `numeros`."""
    diapos = [f'ppt/slides/slide{n}.xml' for n in numeros]

    with zipfile.ZipFile(source) as zf:
        noms = set(zf.namelist())
        for d in diapos:
            if d not in noms:
                raise SystemExit(f'{d} absent du paquet')

        utiles = layouts_utiles(zf, diapos)

        # Purger chaque masque de ses mises en page inemployees.
        masters_elagues = {}
        for nom in noms:
            if re.fullmatch(r'ppt/slideMasters/slideMaster\d+\.xml', nom):
                rels = zf.read(rels_de(nom)).decode('utf-8')
                masters_elagues[nom] = elaguer_master(
                    zf.read(nom).decode('utf-8'), rels, nom, utiles)

        gardees = _atteignables(zf, set(diapos), masters_elagues)
        gardees |= {n for n in SOCLE if n in noms}

        rels_presentation = zf.read('ppt/_rels/presentation.xml.rels').decode('utf-8')

        with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as sortie:
            for nom in sorted(gardees):
                if nom not in noms:
                    continue
                donnees = zf.read(nom)
                if nom in masters_elagues:
                    donnees = masters_elagues[nom].encode('utf-8')
                elif nom == 'ppt/presentation.xml':
                    donnees = elaguer_presentation(
                        donnees.decode('utf-8'), gardees,
                        rels_presentation).encode('utf-8')
                elif nom == '[Content_Types].xml':
                    donnees = elaguer_types(
                        donnees.decode('utf-8'), gardees).encode('utf-8')
                elif nom.endswith('.rels'):
                    base = nom.replace('/_rels/', '/').replace('.rels', '')
                    donnees = elaguer_rels(
                        donnees.decode('utf-8'), gardees, base).encode('utf-8')
                sortie.writestr(nom, donnees)


if __name__ == '__main__':
    import os
    composer(sys.argv[3], sys.argv[1], [int(x) for x in sys.argv[2].split(',')])
    print(f'{os.path.getsize(sys.argv[1]) // 1024} Ko')
