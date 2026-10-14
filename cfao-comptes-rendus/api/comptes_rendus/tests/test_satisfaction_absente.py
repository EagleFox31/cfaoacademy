"""Sans note de qualite, plus de tableaux ni d'anneau de satisfaction."""
import re
import zipfile
from xml.dom import minidom

import pytest

import classeurs
import service

CELLULES = {f'B{i}': None for i in [*range(2, 10), *range(12, 19)]} | {'C9': None, 'C18': None}
PAGE_RESULTATS, FICHE = 'ppt/slides/slide19.xml', 'ppt/slides/slide27.xml'


@pytest.fixture
def contenus(monkeypatch):
    # Aucun lancement de LibreOffice : seul le XML des diapositives compte ici.
    monkeypatch.setattr(classeurs, 'rendre', lambda *a, **k: {})
    with zipfile.ZipFile(service.MODELE) as z:
        return {n: z.read(n) for n in z.namelist()}


def natures(contenus, slide):
    xml = contenus[slide].decode('utf-8')
    rels = contenus[slide.replace('slides/', 'slides/_rels/') + '.rels'].decode('utf-8')
    cibles = dict(re.findall(r'Id="([^"]+)"[^>]*?Target="([^"]+)"', rels))
    trouvees = []
    for m in classeurs.RE_OLE.finditer(xml):
        rid = re.search(r'<p:oleObj [^>]*r:id="([^"]+)"', m.group(0)).group(1)
        parts = classeurs._lire(contenus['ppt/' + cibles[rid].replace('../', '')])
        trouvees.append(classeurs.nature(parts))
    return trouvees


def rafraichir(contenus, slide, cellules):
    classeurs.rafraichir_pages(contenus, [(slide, {'satisfaction': cellules})],
                               service.SOFFICE, service.PROFIL, service.CACHE)


@pytest.mark.parametrize('slide', [PAGE_RESULTATS, FICHE])
def test_sans_aucune_note_l_objet_et_ses_orphelins_disparaissent(contenus, slide):
    assert 'satisfaction' in natures(contenus, slide)
    rafraichir(contenus, slide, CELLULES)
    xml = contenus[slide].decode('utf-8')
    assert 'satisfaction' not in natures(contenus, slide)
    assert 'APPRECIATION DE LA FORMATION ET DE L' not in xml
    assert 'Groupe 13' not in xml
    minidom.parseString(xml)  # le XML reste bien forme


def test_la_fiche_garde_les_autres_objets_et_l_appreciation(contenus):
    avant = natures(contenus, FICHE)
    rafraichir(contenus, FICHE, CELLULES)
    apres = natures(contenus, FICHE)
    assert apres == [n for n in avant if n != 'satisfaction']
    assert 'Appr' in contenus[FICHE].decode('utf-8')


@pytest.mark.parametrize('cellules', [{**CELLULES, 'B9': 0.8}, {**CELLULES, 'B18': 0.9}, {}])
def test_une_note_ou_aucune_valeur_garde_l_objet(contenus, cellules):
    rafraichir(contenus, PAGE_RESULTATS, cellules)
    assert 'satisfaction' in natures(contenus, PAGE_RESULTATS)


def classeur_de_satisfaction(contenus, slide):
    rels = contenus[slide.replace('slides/', 'slides/_rels/') + '.rels'].decode('utf-8')
    for cible in re.findall(r'Target="\.\./(embeddings/[^"]+)"', rels):
        parts = classeurs._lire(contenus['ppt/' + cible])
        if classeurs.nature(parts) == 'satisfaction':
            return parts


def remplies(parts, lignes):
    feuille = parts['xl/worksheets/sheet1.xml'].decode('utf-8')
    return [n for n, contenu in re.findall(r'<c r="[A-C](\d+)"[^>]*?(?:/>|>(.*?)</c>)', feuille, flags=re.S)
            if int(n) in lignes and contenu]


def series(parts):
    graphique = next(parts[n].decode('utf-8') for n in parts
                     if re.match(r'xl/charts/chart\d+\.xml$', n))
    minidom.parseString(graphique)
    return [re.findall(r'<c:f>([^<]*)</c:f>', s) for s in re.findall(r'<c:ser>.*?</c:ser>', graphique, re.S)]


def fusions(parts):
    feuille = parts['xl/worksheets/sheet1.xml'].decode('utf-8')
    minidom.parseString(feuille)
    return re.findall(r'<mergeCell ref="([^"]+)"/>', feuille)


@pytest.mark.parametrize('slide', [PAGE_RESULTATS, FICHE])
def test_sans_note_d_accueil_le_classeur_embarque_n_a_plus_ni_tableau_ni_anneau(contenus, slide):
    rafraichir(contenus, slide, {**CELLULES, 'B2': 0.8, 'B9': 0.8, 'C9': 0.2})
    parts = classeur_de_satisfaction(contenus, slide)
    assert remplies(parts, range(1, 10)) and not remplies(parts, range(11, 19))
    assert fusions(parts) == ['A1:B1']
    assert series(parts) == [['Feuil1!$A$9', 'Feuil1!$B$9:$C$9']]
    assert b'<c:autoTitleDeleted val="1"/>' in parts['xl/charts/chart1.xml']


@pytest.mark.parametrize('slide', [PAGE_RESULTATS, FICHE])
def test_sans_note_de_formation_le_classeur_embarque_n_a_plus_ni_tableau_ni_anneau(contenus, slide):
    rafraichir(contenus, slide, {**CELLULES, 'B12': 0.8, 'B18': 0.75, 'C18': 0.25})
    parts = classeur_de_satisfaction(contenus, slide)  # reconnu par son A11
    assert remplies(parts, range(11, 19)) and not remplies(parts, range(1, 10))
    assert fusions(parts) == ['A11:B11']
    assert series(parts) == [['Feuil1!$A$18', 'Feuil1!$B$18:$C$18']]
    assert b'<c:autoTitleDeleted val="1"/>' in parts['xl/charts/chart1.xml']


@pytest.mark.parametrize('slide', [PAGE_RESULTATS, FICHE])
def test_l_etiquette_de_l_anneau_seul_va_au_centre(contenus, slide):
    """Le decalage ramene la place par defaut (mi-anneau, milieu du secteur) au centre."""
    rafraichir(contenus, slide, {**CELLULES, 'B12': 0.8, 'B18': 0.5, 'C18': 0.5})
    graphique = classeur_de_satisfaction(contenus, slide)['xl/charts/chart1.xml'].decode('utf-8')
    x, y = map(float, re.search(r'<c:dLbl><c:idx val="0"/><c:layout><c:manualLayout>'
                                r'<c:x val="([^"]+)"/><c:y val="([^"]+)"/>', graphique).groups())
    # A 50 %, le milieu du secteur est a droite (90°) : retour a gauche, sans ecart vertical.
    assert x < 0 and abs(y) < 1e-6


def test_une_cle_en_trop_ne_vide_pas_l_objet_sans_le_retirer(contenus):
    rafraichir(contenus, PAGE_RESULTATS, {**CELLULES, 'X1': 0.5})
    assert 'satisfaction' not in natures(contenus, PAGE_RESULTATS)


def test_avec_les_deux_notes_le_classeur_garde_tout(contenus):
    rafraichir(contenus, FICHE, {**CELLULES, 'B9': 0.8, 'C9': 0.2, 'B18': 0.7, 'C18': 0.3})
    parts = classeur_de_satisfaction(contenus, FICHE)
    assert remplies(parts, range(1, 10)) and remplies(parts, range(11, 19))
    assert fusions(parts) == ['A1:B1', 'A11:B11']
    assert len(series(parts)) == 2


def test_les_taux_de_l_anneau_suivent_les_series_restantes(tmp_path, monkeypatch):
    """Sans note de formation, la seule serie restante porte le taux de l'accueil."""
    with zipfile.ZipFile(service.MODELE) as z:
        base = {n: z.read(n) for n in z.namelist()}
    accueil = {**CELLULES, 'B12': 0.8, 'B18': 0.75, 'C18': 0.25}
    parts = classeurs._sans_moitie_absente(
        classeurs.remplir_classeur(classeur_de_satisfaction(base, FICHE), accueil), accueil)
    def convertir(cmd, **k):
        # Un PDF vide tient lieu du rendu de LibreOffice.
        import fitz
        doc = fitz.open()
        doc.new_page()
        doc.save(cmd[-1].replace('.xlsx', '.pdf'))
    monkeypatch.setattr(classeurs.subprocess, 'run', convertir)
    vus = []
    monkeypatch.setattr(classeurs, '_rogner', lambda png, anneau=None, ratio=None, cadre=None: vus.append(anneau) or b'png')
    classeurs.rendre({'a': classeurs._ecrire(parts)}, 'soffice', 'profil', tmp_path,
                     {'a': ('satisfaction', accueil, None)})
    geo, taux = vus[0]
    assert len(geo['series']) == 1 and taux == [0.75]


@pytest.mark.parametrize('slide', [PAGE_RESULTATS, FICHE])
@pytest.mark.parametrize('formation, accueil', [(0.98, 0.9), (0.5, 0.25), (1.0, 0.625)])
def test_les_etiquettes_des_deux_anneaux_gardent_leur_place_quelles_que_soient_les_notes(
        contenus, slide, formation, accueil):
    """Rafraichi dans PowerPoint, l'anneau garde les places de l'apercu :
    la formation au centre du trou, l'accueil dehors, a droite, sans
    chevaucher l'anneau (le decalage du modele ne valait que pour ses notes)."""
    import math
    rafraichir(contenus, slide, {**CELLULES, 'B9': formation, 'C9': 1 - formation,
                                 'B18': accueil, 'C18': 1 - accueil})
    parts = classeur_de_satisfaction(contenus, slide)
    geo = classeurs._geometrie_anneau(parts)
    (larg, haut), z, trou = geo['cadre'], geo['zone'], geo['trou']
    rayon = min(z['w'] * larg, z['h'] * haut) / 2
    cx, cy = (z['x'] + z['w'] / 2) * larg, (z['y'] + z['h'] / 2) * haut
    places = []
    for k, (serie, v) in enumerate(zip(geo['series'], (formation, accueil))):
        rm = (trou + (k + 0.5) * (1 - trou) / 2) * rayon
        places.append((cx + math.sin(v * math.pi) * rm + serie['dx'] * larg,
                       cy - math.cos(v * math.pi) * rm + serie['dy'] * haut))
    assert math.dist(places[0], (cx, cy)) < 0.01 * rayon
    assert places[1][0] > cx + rayon * 1.1 and places[1][0] < larg
    assert cy < places[1][1] < haut


@pytest.mark.parametrize('v', [0.02, 0.25, 0.4, 0.5, 0.62, 0.8, 0.98, 1.0])
def test_le_trait_de_rappel_n_a_que_des_segments_droits(v):
    import math
    point = (100 + math.sin(v * math.pi) * 80, 100 - math.cos(v * math.pi) * 80)
    points = classeurs._trait_orthogonal((100, 100), (40, 15), point)
    assert 2 <= len(points) <= 3 and points[-1] == point
    assert all(a[0] == b[0] or a[1] == b[1] for a, b in zip(points, points[1:]))
    # Il part du bord de l'etiquette, jamais de l'interieur.
    x, y = points[0]
    assert abs(x - 100) >= 40 or abs(y - 100) >= 15


@pytest.mark.parametrize('slide', [PAGE_RESULTATS, FICHE])
@pytest.mark.parametrize('cellules', [{'B9': 0.98, 'C9': 0.02, 'B18': 0.9, 'C18': 0.1},
                                      {'B9': 0.7, 'C9': 0.3}])
def test_le_classeur_embarque_porte_le_trait_en_equerre_de_la_formation(contenus, slide, cellules):
    rafraichir(contenus, slide, {**CELLULES, 'B2': 0.8, 'B12': 0.8, **cellules})
    parts = classeur_de_satisfaction(contenus, slide)
    graphique = parts['xl/charts/chart1.xml'].decode('utf-8')
    minidom.parseString(graphique)
    premiere = re.search(r'<c:ser>.*?</c:ser>', graphique, re.S).group(0)
    assert '<c:showLeaderLines val="0"/>' in premiere
    assert graphique.endswith('<c:userShapes r:id="rIdTrait"/></c:chartSpace>')
    assert b'chartUserShapes' in parts['xl/charts/_rels/chart1.xml.rels']
    assert b'/xl/drawings/drawingTrait.xml' in parts['[Content_Types].xml']
    formes = parts['xl/drawings/drawingTrait.xml'].decode('utf-8')
    minidom.parseString(formes)
    pts = [tuple(map(int, p)) for p in re.findall(r'<a:pt x="(\d+)" y="(\d+)"/>', formes)]
    assert 2 <= len(pts) <= 3
    assert all(a[0] == b[0] or a[1] == b[1] for a, b in zip(pts, pts[1:]))
