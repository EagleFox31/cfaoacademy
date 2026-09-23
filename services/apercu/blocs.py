# -*- coding: utf-8 -*-
"""Les blocs de formes que le modele ne porte qu'une fois.

La page des participants n'a qu'un bloc formateur : un portrait et le
cadre du nom. Une session animee a plusieurs n'y trouvait pas sa place,
et seul le premier formateur apparaissait.

Le bloc est donc repete en ligne, une fois par element, sur la largeur
qui va de son bord gauche au bord droit d'une forme de reference — la
photo de groupe, qui fixe la marge droite de la page. Chaque copie
recoit ses propres valeurs ; ses emplacements photo sont numerotes
(« Emplacement portrait 1 », « … 2 ») pour que les photos s'y posent.

Au-dela de deux copies, la place de chacune se reduit : la police
diminue dans la meme mesure pour que les noms tiennent.
"""
import html
import re

# Les blocs repetables, par diapositive : les formes qui le composent,
# et celle dont le bord droit borne la ligne.
BLOCS = {
    4: {
        'cle': '@formateurs',
        'formes': ('Emplacement portrait', 'Zone de texte 110'),
        'limite': 'Emplacement groupe',
    },
}

# L'espace laisse entre deux blocs voisins.
ECART = 180000

RE_POS = re.compile(r'<a:off x="(\d+)" y="(\d+)"/><a:ext cx="(\d+)" cy="(\d+)"/>')


def _forme(xml, nom):
    return re.search(r'<p:sp>(?:(?!</p:sp>).)*?name="' + re.escape(nom)
                     + r'".*?</p:sp>', xml, re.S)


def repeter(xml, diapo, valeurs):
    """Repete le bloc de la diapositive, une copie par element fourni.

    Sans element, le bloc reste tel quel, drapeaux visibles.
    """
    regle = BLOCS.get(diapo)
    elements = regle and valeurs.get(regle['cle'])
    if not elements:
        return xml
    trouvees = [_forme(xml, nom) for nom in regle['formes']]
    limite = _forme(xml, regle['limite'])
    if not all(trouvees) or not limite:
        return xml

    positions = [tuple(int(v) for v in RE_POS.search(m.group(0)).groups())
                 for m in trouvees]
    lx, _, lcx, _ = (int(v) for v in RE_POS.search(limite.group(0)).groups())
    x0 = min(p[0] for p in positions)
    n = len(elements)
    largeur = (lx + lcx - x0) // n
    echelle = min(1.0, 2 / n) ** 0.5 if n > 2 else 1.0

    copies = []
    for i, element in enumerate(elements):
        for k, (m, pos) in enumerate(zip(trouvees, positions)):
            x, y, cx, cy = pos
            forme = m.group(0)
            nx = x + i * largeur
            # Le cadre de texte s'etend jusqu'au bloc suivant ; le
            # portrait garde sa taille.
            ncx = cx if 'Emplacement' in regle['formes'][k] or n == 1 \
                else largeur - (x - x0) - ECART
            forme = RE_POS.sub(
                f'<a:off x="{nx}" y="{y}"/><a:ext cx="{ncx}" cy="{cy}"/>',
                forme, count=1)
            forme = re.sub(r'<p:cNvPr id="\d+"',
                           f'<p:cNvPr id="{3000 + i * 10 + k}"', forme, count=1)
            nom = regle['formes'][k]
            if nom.startswith('Emplacement'):
                forme = forme.replace(f'name="{nom}"', f'name="{nom} {i + 1}"', 1)
            if echelle < 1:
                forme = re.sub(
                    r'sz="(\d+)"',
                    lambda s: f'sz="{round(int(s.group(1)) * echelle)}"', forme)
            for drapeau, valeur in element.items():
                if drapeau.startswith('{'):
                    forme = forme.replace(
                        drapeau, html.escape(str(valeur), quote=False))
            copies.append(forme)

    # Les formes d'origine s'effacent ; les copies prennent la place de
    # la premiere.
    ordre = sorted(trouvees, key=lambda m: m.start())
    for m in reversed(ordre[1:]):
        xml = xml[:m.start()] + xml[m.end():]
    premier = ordre[0]
    return xml[:premier.start()] + ''.join(copies) + xml[premier.end():]
