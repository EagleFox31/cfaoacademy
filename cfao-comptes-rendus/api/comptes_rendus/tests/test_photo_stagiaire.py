"""La photo du stagiaire, posee a droite de son appreciation sur la fiche."""
import io
import re

from PIL import Image

import photos

ZONE = ('<p:sp><p:nvSpPr><p:cNvPr id="10" name="ZoneTexte 9"/></p:nvSpPr><p:spPr><a:xfrm>'
        '<a:off x="170688" y="4944618"/><a:ext cx="7827264" cy="1707642"/></a:xfrm></p:spPr>'
        '<p:txBody><a:p><a:r><a:t>Appreciation</a:t></a:r></a:p></p:txBody></p:sp>')
SLIDE = 'ppt/slides/slide27.xml'


def _contenus():
    return {
        SLIDE: f'<p:sld><p:spTree>{ZONE}</p:spTree></p:sld>'.encode(),
        'ppt/slides/_rels/slide27.xml.rels': b'<Relationships></Relationships>',
        '[Content_Types].xml': b'<Types><Default Extension="xml" ContentType="x"/></Types>',
    }


def _photo():
    tampon = io.BytesIO()
    Image.new('RGB', (60, 40), (20, 80, 200)).save(tampon, 'JPEG')
    return photos.enregistrer(tampon.getvalue(), None)['id']


def test_la_zone_se_retrecit_et_la_photo_carree_se_pose_a_droite():
    contenus = _contenus()
    photos.poser_nommes(contenus, SLIDE, {'ZoneTexte 9': {'id': _photo(), 'cote': 'droite'}}, None)
    xml = contenus[SLIDE].decode()
    assert 'Appreciation' in xml
    assert f'<a:ext cx="{7827264 - 1707642 - photos.ECART}" cy="1707642"/>' in xml
    pic = re.search(r'<p:pic>.*?</p:pic>', xml, re.S).group(0)
    assert f'<a:off x="{170688 + 7827264 - 1707642}" y="4944618"/>' in pic
    assert '<a:ext cx="1707642" cy="1707642"/>' in pic
    # Plus large que haute : rognee sur les cotes pour rester carree.
    assert re.search(r'<a:srcRect l="\d+" r="\d+"', pic)


def test_sans_cote_la_photo_remplace_toujours_l_emplacement():
    contenus = _contenus()
    photos.poser_nommes(contenus, SLIDE, {'ZoneTexte 9': {'id': _photo()}}, None)
    xml = contenus[SLIDE].decode()
    assert 'Appreciation' not in xml and '<p:pic>' in xml
