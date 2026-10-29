"""L'equipe technique lit les comptes rendus de tous les formateurs, sans les modifier."""
import json

import pytest

from comptes_rendus.models import Brouillon, Photo

B1 = "/cr-donnees/brouillons/b1"


@pytest.fixture
def admin(settings, tmp_path, client):
    profils = json.loads(open(settings.PROFILS_LOCAUX, encoding="utf-8").read())
    profils.append({"identifiant": "tech", "id": "tech", "roles": ["superadmin"]})
    (tmp_path / "profils.json").write_text(json.dumps(profils), encoding="utf-8")
    settings.PROFILS_LOCAUX = str(tmp_path / "profils.json")
    return client("tech")


def test_l_equipe_technique_voit_les_brouillons_de_tous(client, admin):
    client("f-demo").put(B1, {"intitule": "A", "modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    assert [b["intitule"] for b in admin.get("/cr-donnees/brouillons").json()["brouillons"]] == ["A"]
    assert admin.get(B1).json()["intitule"] == "A"


def test_son_enregistrement_ne_touche_pas_l_original(client, admin):
    f = client("f-demo")
    f.put(B1, {"intitule": "A", "modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    revision = admin.get(B1).json()["revision"]
    r = admin.put(B1, {"intitule": "B", "revision": revision,
                       "modifieLe": "2026-01-02T00:00:00.000Z"}, format="json")
    assert r.json()["ecrit"] is True
    admin.delete(B1)
    assert f.get(B1).json()["intitule"] == "A"
    assert Brouillon.objects.get(owner="f-demo").contenu["intitule"] == "A"


def test_la_liste_ne_double_pas_un_brouillon_copie(client, admin):
    client("f-demo").put(B1, {"intitule": "A", "modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    admin.put(B1, {"intitule": "B", "modifieLe": "2026-01-02T00:00:00.000Z"}, format="json")
    assert [b["intitule"] for b in admin.get("/cr-donnees/brouillons").json()["brouillons"]] == ["B"]


def test_un_formateur_reste_cloisonne(client, admin):
    admin.put(B1, {"intitule": "T", "modifieLe": "2026-01-01T00:00:00.000Z"}, format="json")
    Photo.objects.create(owner="tech", ident="a" * 16)
    f = client("f-demo")
    assert f.get(B1).status_code == 404
    assert f.get("/cr-donnees/brouillons").json()["brouillons"] == []
    assert f.get("/cr-donnees/photos/" + "a" * 16).status_code == 404
