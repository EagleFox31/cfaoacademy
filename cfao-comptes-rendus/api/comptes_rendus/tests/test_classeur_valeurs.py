"""Une cellule remplie garde sa valeur quand Excel recalcule le classeur."""
import re
import zipfile

import classeurs
import service


def acquisition():
    with zipfile.ZipFile(service.MODELE) as z:
        for n in z.namelist():
            if n.startswith('ppt/embeddings/') and n.endswith('.xlsx'):
                parts = classeurs._lire(z.read(n))
                if classeurs.nature(parts) == 'acquisition':
                    return parts
    raise AssertionError('classeur d’acquisition introuvable')


def test_le_score_final_ne_garde_pas_la_moyenne_du_modele():
    # Notes manquantes : le score final (moyenne des stagiaires) n'est pas
    # la moyenne de la theorie et de la pratique. Excel, en recalculant
    # AVERAGE(B2:B3) a l'activation, afficherait un autre chiffre.
    feuille = classeurs.remplir_classeur(acquisition(), {'B2': 0.9, 'B3': 0.7, 'B4': 0.83})[
        'xl/worksheets/sheet1.xml'].decode('utf-8')
    b4 = re.search(r'<c r="B4"[^>]*>(.*?)</c>', feuille, re.S).group(1)
    assert '<f' not in b4 and '<v>0.83</v>' in b4


def test_une_formule_non_remplie_reste():
    parts = acquisition()
    feuille = classeurs.remplir_classeur(parts, {'B2': 0.9})['xl/worksheets/sheet1.xml']
    assert b'<f>AVERAGE(B2:B3)</f>' in feuille

