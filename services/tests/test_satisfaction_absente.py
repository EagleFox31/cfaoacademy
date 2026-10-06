"""Sans note de qualite, la page de satisfaction n'affiche ni tableaux ni anneau."""
import zipfile

import classeurs
import service

CELLULES = {f'B{i}': None for i in list(range(2, 10)) + list(range(12, 19))} | {'C9': None, 'C18': None}


def _modele():
    with zipfile.ZipFile(service.MODELE) as z:
        return {n: z.read(n) for n in z.namelist()}


def _objets_satisfaction(contenus, slide):
    xml = contenus[slide].decode('utf-8')
    rels = contenus[slide.replace('slides/', 'slides/_rels/') + '.rels'].decode('utf-8')
    trouves = []
    for m in classeurs.RE_OLE.finditer(xml):
        import re
        rid = re.search(r'<p:oleObj [^>]*r:id="([^"]+)"', m.group(0)).group(1)
        cible = dict(re.findall(r'Id="([^"]+)"[^>]*?Target="([^"]+)"', rels))[rid]
        parts = classeurs._lire(contenus['ppt/' + cible.replace('../', '')])
        trouves.append(classeurs.nature(parts))
    return trouves


def test_l_objet_de_satisfaction_est_retire_sans_aucune_note():
    contenus = _modele()
    slide = 'ppt/slides/slide19.xml'
    assert 'satisfaction' in _objets_satisfaction(contenus, slide)
    classeurs.rafraichir_pages(contenus, [(slide, {'satisfaction': CELLULES})],
                               service.SOFFICE, service.PROFIL, service.CACHE)
    assert 'satisfaction' not in _objets_satisfaction(contenus, slide)


def test_une_seule_note_garde_l_objet(monkeypatch):
    contenus = _modele()
    slide = 'ppt/slides/slide19.xml'
    monkeypatch.setattr(classeurs, 'rendre', lambda *a, **k: {})
    classeurs.rafraichir_pages(contenus, [(slide, {'satisfaction': {**CELLULES, 'B9': 0.8}})],
                               service.SOFFICE, service.PROFIL, service.CACHE)
    assert 'satisfaction' in _objets_satisfaction(contenus, slide)
