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


NOTES = [0.0, 0.02, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.84, 0.9, 0.98, 1.0]


def geometrie(contenus, slide, formation, accueil):
    rafraichir(contenus, slide, {**CELLULES, 'B2': 0.8, 'B12': 0.8, 'B9': formation,
                                 'C9': 1 - formation, 'B18': accueil, 'C18': 1 - accueil})
    return classeur_de_satisfaction(contenus, slide)


def droit(points):
    return all(abs(a[0] - b[0]) < 1e-6 or abs(a[1] - b[1]) < 1e-6
               for a, b in zip(points, points[1:]))


@pytest.mark.parametrize('slide', [PAGE_RESULTATS, FICHE])
def test_le_trait_de_l_accueil_part_du_milieu_rempli_et_rejoint_son_texte_sans_biais(contenus, slide):
    """Un, deux ou trois segments droits selon le remplissage ; ni l'etiquette
    ni le trait ne coupent l'anneau ; l'etiquette reste dans le graphique."""
    import math
    geo = classeurs._geometrie_anneau(geometrie(contenus, slide, 0.8, 0.5))
    (larg, haut), z = geo['cadre'], geo['zone']
    rayon = 1.015 * min(z['w'] * larg, z['h'] * haut) / 2
    cx, cy = (z['x'] + z['w'] / 2) * larg, (z['y'] + z['h'] / 2) * haut
    vis_l, vis_h = geo['visible']
    if slide == FICHE:
        # Sur la fiche, la colonne au-dela de B coupe la droite du graphique.
        assert vis_l < 0.95 * larg
    longueurs = set()
    for accueil in NOTES:
        formation, place = classeurs._disposition_anneau(geo, [0.8, accueil])
        trait, (ex, ey), (lw, lh) = place['trait'], place['centre'], place['boite']
        assert trait[0] == place['defaut'] and 2 <= len(trait) <= 4 and droit(trait)
        longueurs.add(len(trait) - 1)
        # L'arrivee s'arrete juste avant le texte : a gauche, a sa hauteur ;
        # en haut ou en bas, sous sa largeur.
        fx, fy, marge = *trait[-1], 0.03 * rayon
        assert (abs(fx - (ex - lw / 2 - marge)) < 1 and abs(fy - ey) <= 0.3 * lh) or \
               (abs(abs(fy - ey) - lh / 2 - marge) < 1 and abs(fx - ex) <= lw / 2)
        # L'etiquette dans la part visible de l'objet (`oleSize`), hors du cercle.
        assert 0 <= ey - lh / 2 and ey + lh / 2 <= vis_h and ex + lw / 2 <= vis_l
        coin_x = min(max(cx, ex - lw / 2), ex + lw / 2)
        coin_y = min(max(cy, ey - lh / 2), ey + lh / 2)
        assert math.hypot(coin_x - cx, coin_y - cy) > rayon
        # Le trait sort de l'anneau sans y revenir.
        for a, b in zip(trait, trait[1:]):
            d = [math.hypot(a[0] + (b[0] - a[0]) * t / 20 - cx, a[1] + (b[1] - a[1]) * t / 20 - cy)
                 for t in range(21)]
            assert all(d2 >= d1 - 1 or d2 > rayon for d1, d2 in zip(d, d[1:]))
        # Celui de la formation reste droit, au centre.
        assert formation['centre'] == (cx, cy)
    assert longueurs <= {1, 2, 3}


@pytest.mark.parametrize('slide', [PAGE_RESULTATS, FICHE])
@pytest.mark.parametrize('formation, accueil', [(0.98, 0.9), (0.5, 0.25), (1.0, 0.625), (0.86, 0.84)])
def test_l_objet_excel_reprend_la_disposition_de_l_apercu(contenus, slide, formation, accueil):
    """Decalages des etiquettes et traits poses dans le graphique Excel :
    ceux de `_disposition_anneau`, sans trait d'Excel."""
    parts = geometrie(contenus, slide, formation, accueil)
    geo = classeurs._geometrie_anneau(parts)
    (larg, haut) = geo['cadre']
    places = classeurs._disposition_anneau(geo, [formation, accueil])
    for serie, place in zip(geo['series'], places):
        assert abs(place['defaut'][0] + serie['dx'] * larg - place['centre'][0]) < 100
        assert abs(place['defaut'][1] + serie['dy'] * haut - place['centre'][1]) < 100
    graphique = parts['xl/charts/chart1.xml'].decode('utf-8')
    minidom.parseString(graphique)
    assert '<c:showLeaderLines val="1"/>' not in graphique
    assert graphique.endswith('<c:userShapes r:id="rIdTrait"/></c:chartSpace>')
    assert b'chartUserShapes' in parts['xl/charts/_rels/chart1.xml.rels']
    assert b'/xl/drawings/drawingTrait.xml' in parts['[Content_Types].xml']
    formes = parts['xl/drawings/drawingTrait.xml'].decode('utf-8')
    minidom.parseString(formes)
    chemins = re.findall(r'<a:path [^>]*>(.*?)</a:path>', formes)
    attendus = [p['trait'] for p in places if p['trait']]
    assert len(chemins) == len(attendus)
    accueil_pts = [tuple(map(int, p)) for p in re.findall(r'<a:pt x="(\d+)" y="(\d+)"/>', chemins[-1])]
    assert len(accueil_pts) == len(attendus[-1]) and droit(accueil_pts)


def test_la_fiche_individuelle_se_rafraichit_avec_ses_signes_d_acquisition(contenus):
    """L'objet d'acquisition de la fiche recoit ses signes « + » et « = »."""
    classeurs.rafraichir_pages(contenus, [(FICHE, {'acquisition': {}, 'satisfaction': CELLULES})],
                               service.SOFFICE, service.PROFIL, service.CACHE)
    assert 'acquisition' in natures(contenus, FICHE)
