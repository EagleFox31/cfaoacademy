"""Une photo laissee vide par une ecriture interrompue."""
import io

from PIL import Image

import photos


def _jpeg():
    tampon = io.BytesIO()
    Image.new('RGB', (40, 30), (200, 80, 20)).save(tampon, 'JPEG')
    return tampon.getvalue()


def test_un_fichier_vide_n_est_pas_une_photo():
    ident = photos.enregistrer(_jpeg(), None)['id']
    (photos.PERMANENT / f'{ident}.jpg').write_bytes(b'')
    assert photos._chemin(ident) is None


def test_le_meme_envoi_repare_le_fichier_vide():
    ident = photos.enregistrer(_jpeg(), None)['id']
    chemin = photos.PERMANENT / f'{ident}.jpg'
    chemin.write_bytes(b'')
    assert photos.enregistrer(_jpeg(), None)['id'] == ident
    assert chemin.stat().st_size > 0
    assert photos._chemin(ident) == chemin
    assert not list(photos.PERMANENT.glob('*.tmp'))


def test_la_photo_vide_ne_bloque_pas_son_adresse(connecte):
    client = connecte()
    ident = client.post('/apercu/photo', data=_jpeg()).get_json()['id']
    assert client.get(f'/cr-donnees/photos/{ident}.jpg').status_code == 200
    (photos.PERMANENT / f'{ident}.jpg').write_bytes(b'')
    assert client.get(f'/cr-donnees/photos/{ident}.jpg').status_code == 404
