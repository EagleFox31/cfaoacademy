"""Le cache des images de classeurs sert vraiment, et un classeur n'est rendu qu'une fois."""
import time

import classeurs


def test_un_meme_contenu_donne_les_memes_octets():
    parts = {'xl/workbook.xml': b'<workbook/>', 'xl/worksheets/sheet1.xml': b'<worksheet/>'}
    avant = classeurs._ecrire(parts)
    time.sleep(2.1)  # la date d'un zip a une resolution de deux secondes
    assert classeurs._ecrire(parts) == avant


def test_deux_classeurs_identiques_un_seul_rendu_puis_le_cache(tmp_path, monkeypatch):
    brut = classeurs._ecrire({'xl/workbook.xml': b'<workbook/>'})
    monkeypatch.setattr(classeurs, '_pour_rendu', lambda parts: parts)
    lancements = []

    def convertir(cmd, **k):
        import fitz
        fichiers = [c for c in cmd if c.endswith('.xlsx')]
        lancements.append(fichiers)
        for f in fichiers:
            doc = fitz.open()
            doc.new_page()
            doc.save(f.replace('.xlsx', '.pdf'))
    monkeypatch.setattr(classeurs.subprocess, 'run', convertir)
    monkeypatch.setattr(classeurs, '_rogner', lambda image, anneau=None, ratio=None, cadre=None: b'png')

    images = classeurs.rendre({'a': brut, 'b': brut}, 'soffice', 'profil', tmp_path)
    assert images == {'a': b'png', 'b': b'png'}
    assert len(lancements) == 1 and len(lancements[0]) == 1

    classeurs.rendre({'c': brut}, 'soffice', 'profil', tmp_path)
    assert len(lancements) == 1  # servi par le cache
