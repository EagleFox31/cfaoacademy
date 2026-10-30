import io

from PIL import Image

import classeurs


def _cadre(rid, x, y, cx, cy):
    off = f'<a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/>'
    return (f'<p:graphicFrame><p:xfrm>{off}</p:xfrm><a:graphic><a:graphicData>'
            f'<p:oleObj progId="Excel.Sheet.12" r:id="{rid}"><p:embed/><p:pic>'
            f'<p:spPr><a:xfrm>{off}</a:xfrm></p:spPr></p:pic></p:oleObj>'
            f'</a:graphicData></a:graphic></p:graphicFrame>')


def _png(boite, taille=(100, 100)):
    image = Image.new('RGBA', taille, (0, 0, 0, 0))
    image.paste((0, 0, 0, 255), boite)
    sortie = io.BytesIO()
    image.save(sortie, 'PNG')
    return sortie.getvalue()


def test_objet_centre_sous_son_titre_et_hauts_alignes():
    xml = _cadre('rId2', 1000, 2000, 1000, 1000) + _cadre('rId3', 5000, 2100, 1000, 1000)
    # rId2 : contenu colle a gauche (0..60) ; rId3 : centre, mais 10 px plus bas.
    xml = classeurs.placer_objets(xml, [('rId2', _png((0, 0, 60, 100))),
                                        ('rId3', _png((20, 10, 80, 100)))])
    # rId2 decale de (40 - 0) / 2 px * 10 EMU ; rId3 remonte pour que son haut
    # visible (2100 + 100) rejoigne celui de rId2 (2000).
    assert xml.count('<a:off x="1200" y="2000"/>') == 2
    assert xml.count('<a:off x="5000" y="1900"/>') == 2


def test_centrage_sur_la_largeur_utile_et_non_sur_le_dessin():
    # Une note absente laisse sa place vide : le dessin (0..50) est plus
    # etroit que l'image complete (90 px utiles, 10 px de bord des
    # proportions). Le cadre ne bouge que de ce bord, comme avec deux notes.
    from PIL.PngImagePlugin import PngInfo
    image = Image.new('RGBA', (100, 100), (0, 0, 0, 0))
    image.paste((0, 0, 0, 255), (0, 0, 50, 100))
    infos = PngInfo()
    infos.add_text('largeur-utile', '90')
    sortie = io.BytesIO()
    image.save(sortie, 'PNG', pnginfo=infos)
    xml = classeurs.placer_objets(_cadre('rId2', 1000, 2000, 1000, 1000),
                                  [('rId2', sortie.getvalue())])
    assert xml.count('<a:off x="1050" y="2000"/>') == 2
