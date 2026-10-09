"""Une photo laissee vide par une ecriture interrompue, et le cloisonnement des photos."""
import io

from PIL import Image

import photos


def _jpeg():
    tampon = io.BytesIO()
    Image.new("RGB", (40, 30), (200, 80, 20)).save(tampon, "JPEG")
    return tampon.getvalue()


def _envoyer(c):
    return c.post("/apercu/photo", data=_jpeg(), content_type="image/jpeg")


def test_un_fichier_vide_n_est_pas_une_photo():
    ident = photos.enregistrer(_jpeg(), None)["id"]
    (photos.PERMANENT / f"{ident}.jpg").write_bytes(b"")
    assert photos._chemin(ident) is None


def test_le_meme_envoi_repare_le_fichier_vide():
    ident = photos.enregistrer(_jpeg(), None)["id"]
    chemin = photos.PERMANENT / f"{ident}.jpg"
    chemin.write_bytes(b"")
    assert photos.enregistrer(_jpeg(), None)["id"] == ident
    assert chemin.stat().st_size > 0
    assert photos._chemin(ident) == chemin
    assert not list(photos.PERMANENT.glob("*.tmp"))


def test_la_photo_vide_ne_bloque_pas_son_adresse(client):
    c = client()
    ident = _envoyer(c).json()["id"]
    r = c.get(f"/cr-donnees/photos/{ident}.jpg?v=2")
    assert r.status_code == 200 and r["Content-Type"] == "image/jpeg"
    assert r["Cache-Control"] == "private, no-cache"
    (photos.PERMANENT / f"{ident}.jpg").write_bytes(b"")
    assert c.get(f"/cr-donnees/photos/{ident}.jpg").status_code == 404


def test_un_formateur_ne_voit_pas_la_photo_d_un_autre(client):
    ident = _envoyer(client("fa")).json()["id"]
    assert client("fb").get(f"/cr-donnees/photos/{ident}.jpg").status_code == 404


def test_un_envoi_vide_est_refuse(client):
    r = client().post("/apercu/photo", data=b"", content_type="image/jpeg")
    assert r.status_code == 400 and r.json() == {"erreur": "image attendue"}
