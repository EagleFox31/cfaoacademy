"""Reduit un PPTX a ce qu'une diapositive donnee utilise reellement.

Le modele CFAO embarque 572 mises en page et 22 masques pour 28
diapositives. LibreOffice analyse tout le paquet a chaque ouverture,
ce qui coute une vingtaine de secondes quelle que soit la diapositive
demandee.

On garde donc uniquement les parties atteignables depuis la diapositive
voulue, en suivant les relations de proche en proche : la diapositive,
sa mise en page, le masque de celle-ci, leurs themes et leurs images.
Tout le reste est laisse de cote.

Usage :
    python alleger.py source.pptx destination.pptx [no_diapo]
"""

import re
import shutil
import sys
import zipfile
from pathlib import PurePosixPath

# Les parties sans lesquelles le paquet n'est plus lisible, ou dont
# l'absence degrade le rendu.
#
# `tableStyles.xml` merite une mention : il n'est atteignable que depuis
# presentation.xml, qu'on n'emprunte pas comme point de depart. Sans lui
# les bordures de tableau perdent leur couleur de theme et retombent au
# noir, ce qui se voit sur les pages de resultats.
SOCLE = {
    '[Content_Types].xml',
    '_rels/.rels',
    'ppt/presentation.xml',
    'ppt/_rels/presentation.xml.rels',
    'ppt/tableStyles.xml',
    'ppt/presProps.xml',
    'docProps/app.xml',
    'docProps/core.xml',
}

RE_CIBLE = re.compile(r'Target="([^"]+)"')
RE_EXTERNE = re.compile(r'TargetMode="External"')
RE_RELATION = re.compile(r'<Relationship\b[^>]*/>')


def rels_de(nom):
    """Chemin du fichier de relations d'une partie."""
    p = PurePosixPath(nom)
    return str(p.parent / '_rels' / (p.name + '.rels'))


def resoudre(base, cible):
    """Resout une cible relative depuis la partie qui la reference."""
    if cible.startswith('/'):
        return cible.lstrip('/')
    return str((PurePosixPath(base).parent / cible).as_posix()).replace('/./', '/')


def normaliser(chemin):
    """Aplatit les '..' d'un chemin de paquet."""
    morceaux = []
    for m in chemin.split('/'):
        if m == '..':
            if morceaux:
                morceaux.pop()
        elif m and m != '.':
            morceaux.append(m)
    return '/'.join(morceaux)


def cibles(zf, partie):
    """Les parties internes referencees par une partie donnee."""
    chemin = rels_de(partie)
    try:
        xml = zf.read(chemin).decode('utf-8')
    except KeyError:
        return []
    trouvees = []
    for relation in RE_RELATION.findall(xml):
        if RE_EXTERNE.search(relation):
            continue
        m = RE_CIBLE.search(relation)
        if m:
            trouvees.append(normaliser(resoudre(partie, m.group(1))))
    return trouvees


def layouts_utiles(zf, diapos):
    """Les mises en page employees par un ensemble de diapositives."""
    utiles = set()
    for nom in diapos:
        rels = rels_de(nom)
        if rels not in zf.namelist():
            continue
        for relation in RE_RELATION.findall(zf.read(rels).decode('utf-8')):
            m = RE_CIBLE.search(relation)
            if m:
                cible = normaliser(resoudre(nom, m.group(1)))
                if 'slideLayout' in cible:
                    utiles.add(cible)
    return utiles


def elaguer_master(xml, rels_xml, master, utiles):
    """Retire d'un masque les mises en page qui ne servent pas.

    Un masque conserve entraine ses cinquante mises en page, alors
    qu'une poignee sert. On coupe le lien ici pour les rendre
    inatteignables, donc supprimables.
    """
    orphelins = set()
    for relation in RE_RELATION.findall(rels_xml):
        m_id = re.search(r'\sId="([^"]+)"', relation)
        m_cible = RE_CIBLE.search(relation)
        if m_id and m_cible:
            cible = normaliser(resoudre(master, m_cible.group(1)))
            if 'slideLayout' in cible and cible not in utiles:
                orphelins.add(m_id.group(1))

    def garder(m):
        rid = re.search(r'r:id="([^"]+)"', m.group(0))
        return '' if rid and rid.group(1) in orphelins else m.group(0)

    return re.sub(r'<p:sldLayoutId\s[^>]*/>', garder, xml)


def atteignables(zf, depart):
    """Fermeture transitive des relations, depuis un ensemble de parties."""
    vus = set()
    pile = list(depart)
    while pile:
        partie = pile.pop()
        if partie in vus or partie not in zf.namelist():
            continue
        vus.add(partie)
        rels = rels_de(partie)
        if rels in zf.namelist():
            vus.add(rels)
        pile.extend(cibles(zf, partie))
    return vus


def elaguer_presentation(xml, gardees, rels_xml):
    """Retire de presentation.xml ce qui ne survit pas a l'elagage.

    Une reference `r:id` qui ne pointe plus vers rien fait echouer
    l'ouverture : on supprime donc les `<p:sldId>` et les
    `<p:sldMasterId>` orphelins. Les masques comptent le plus, chacun
    entrainant sa cinquantaine de mises en page.
    """
    valides = set()
    for relation in RE_RELATION.findall(rels_xml):
        m_id = re.search(r'\sId="([^"]+)"', relation)
        m_cible = RE_CIBLE.search(relation)
        if m_id and m_cible:
            cible = normaliser(resoudre('ppt/presentation.xml', m_cible.group(1)))
            if cible in gardees:
                valides.add(m_id.group(1))

    def garder(m):
        rid = re.search(r'r:id="([^"]+)"', m.group(0))
        return m.group(0) if rid and rid.group(1) in valides else ''

    xml = re.sub(r'<p:sldId\s[^>]*/>', garder, xml)
    xml = re.sub(r'<p:sldMasterId\s[^>]*/>', garder, xml)

    # Les listes d'extension p14 rejouent les identifiants des sections
    # et referencent des diapositives disparues.
    xml = re.sub(r'<p:extLst>.*?</p:extLst>', '', xml, flags=re.S)
    return xml


def elaguer_rels(xml, gardees, base):
    """Retire les relations pointant vers des parties supprimees."""
    def garder(m):
        relation = m.group(0)
        if RE_EXTERNE.search(relation):
            return relation
        cible = RE_CIBLE.search(relation)
        if not cible:
            return relation
        resolue = normaliser(resoudre(base, cible.group(1)))
        return relation if resolue in gardees else ''
    return RE_RELATION.sub(garder, xml)


def elaguer_types(xml, gardees):
    """Retire les declarations Override des parties supprimees."""
    def garder(m):
        nom = re.search(r'PartName="/([^"]+)"', m.group(0))
        return m.group(0) if not nom or nom.group(1) in gardees else ''
    return re.sub(r'<Override\b[^>]*/>', garder, xml)


def alleger(source, destination, no_diapo=1):
    with zipfile.ZipFile(source) as zf:
        noms = set(zf.namelist())
        diapo = f'ppt/slides/slide{no_diapo}.xml'
        if diapo not in noms:
            raise SystemExit(f'{diapo} absent du paquet')

        # On part de la seule diapositive : sa mise en page, le masque
        # de celle-ci et leurs themes suivent. Partir aussi de
        # presentation.xml ramenerait les onze masques du modele, et
        # avec eux les 572 mises en page qu'on cherche a ecarter.
        gardees = atteignables(zf, {diapo})
        gardees |= {n for n in SOCLE if n in noms}

        rels_presentation = zf.read('ppt/_rels/presentation.xml.rels').decode('utf-8')

        with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as sortie:
            for nom in sorted(gardees):
                if nom not in noms:
                    continue
                donnees = zf.read(nom)
                if nom == 'ppt/presentation.xml':
                    xml = elaguer_presentation(
                        donnees.decode('utf-8'), gardees, rels_presentation)
                    donnees = xml.encode('utf-8')
                elif nom == '[Content_Types].xml':
                    donnees = elaguer_types(
                        donnees.decode('utf-8'), gardees).encode('utf-8')
                elif nom.endswith('.rels'):
                    base = nom.replace('/_rels/', '/').replace('.rels', '')
                    donnees = elaguer_rels(
                        donnees.decode('utf-8'), gardees, base).encode('utf-8')
                sortie.writestr(nom, donnees)

    avant = zipfile.ZipFile(source).namelist()
    apres = zipfile.ZipFile(destination).namelist()
    print(f'{len(avant)} parties -> {len(apres)}')
    import os
    print(f'{os.path.getsize(source) // 1024} Ko -> '
          f'{os.path.getsize(destination) // 1024} Ko')


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    no = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    alleger(src, dst, no)
