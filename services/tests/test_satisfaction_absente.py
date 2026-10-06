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
