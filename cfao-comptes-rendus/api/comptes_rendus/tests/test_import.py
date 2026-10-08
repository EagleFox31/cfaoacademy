"""Reprise de l'ancien service Flask, sur une base fabriquee ici (aucune donnee reelle)."""
import json
import sqlite3
from io import StringIO

import pytest
from django.core.management import CommandError, call_command

import photos
from comptes_rendus.models import Brouillon, Photo, Suppression


@pytest.fixture
def ancien(tmp_path):
    """Un dossier `donnees` au format Flask : deux formateurs fictifs."""
    dossier = tmp_path / "ancien"
    (dossier / "photos").mkdir(parents=True)
    (dossier / "photos" / "aa11.jpg").write_bytes(b"\xff\xd8photo")
    (dossier / "photos" / "bb22.jpg").write_bytes(b"")  # restee vide
    cx = sqlite3.connect(dossier / "comptes-rendus.sqlite")
    cx.execute("CREATE TABLE brouillons (utilisateur TEXT, id TEXT, contenu TEXT, modifie_le TEXT)")
    cx.execute("CREATE TABLE supprimes (utilisateur TEXT, id TEXT, le TEXT)")
    contenu = {"titre": "Session fictive", "marque": "toyota", "modifieLe": "2026-01-02T10:00:00.000Z",
               "photos": {"objectifs": [{"id": "p1", "ref": "aa11"}, {"id": "p2", "ref": "bb22"}]}}
    cx.executemany("INSERT INTO brouillons VALUES (?, ?, ?, ?)", [
        ("ancien-a", "b1", json.dumps(contenu), "2026-01-02T10:00:00.000Z"),
        ("ancien-b", "b2", json.dumps({"titre": "Autre"}), "2026-01-03T10:00:00.000Z"),
    ])
    cx.execute("INSERT INTO supprimes VALUES ('ancien-a', 'b9', '2026-01-01T00:00:00.000Z')")
    cx.commit()
    cx.close()
    return dossier


def _importer(ancien, tmp_path, *options, table=None):
    if table is not None:
        chemin = tmp_path / "correspondance.json"
        chemin.write_text(json.dumps(table), encoding="utf-8")
        options = ("--correspondance", str(chemin), *options)
    sortie = StringIO()
    call_command("importer_flask", "--source", str(ancien), *options, stdout=sortie)
    return sortie.getvalue()


def test_les_brouillons_suivent_la_correspondance(ancien, tmp_path, db):
    sortie = _importer(ancien, tmp_path, table={"ancien-a": "kc-a"})
    b = Brouillon.objects.get(owner="kc-a", ident="b1")
    assert b.contenu["titre"] == "Session fictive" and b.brand == "toyota"
    assert Suppression.objects.filter(owner="kc-a", ident="b9").exists()
    assert not Brouillon.objects.filter(ident="b2").exists()
    assert "ancien-b" in sortie


def test_seules_les_photos_lisibles_sont_reprises_et_rattachees(ancien, tmp_path, db):
    _importer(ancien, tmp_path, table={"ancien-a": "kc-a"})
    assert list(Photo.objects.values_list("owner", "ident")) == [("kc-a", "aa11")]
    assert (photos.PERMANENT / "aa11.jpg").read_bytes() == b"\xff\xd8photo"
    assert not (photos.PERMANENT / "bb22.jpg").exists()


def test_un_essai_n_ecrit_rien(ancien, tmp_path, db):
    sortie = _importer(ancien, tmp_path, "--essai", "--garder-ids")
    assert sortie.startswith("[essai] brouillons : 2")
    assert not Brouillon.objects.exists() and not Photo.objects.exists()
    assert not (photos.PERMANENT / "aa11.jpg").exists()


def test_une_version_plus_recente_deja_reprise_l_emporte(ancien, tmp_path, db):
    Brouillon.objects.create(owner="ancien-a", ident="b1", contenu={"titre": "Plus recent"},
                             modifie_le="2026-02-01T00:00:00.000Z")
    _importer(ancien, tmp_path, "--garder-ids")
    assert Brouillon.objects.get(owner="ancien-a", ident="b1").contenu["titre"] == "Plus recent"


def test_relancer_l_import_ne_double_rien(ancien, tmp_path, db):
    _importer(ancien, tmp_path, "--garder-ids")
    _importer(ancien, tmp_path, "--garder-ids")
    assert Brouillon.objects.count() == 2 and Photo.objects.count() == 1


def test_l_ancienne_base_n_est_jamais_modifiee(ancien, tmp_path, db):
    avant = (ancien / "comptes-rendus.sqlite").read_bytes()
    _importer(ancien, tmp_path, "--garder-ids")
    assert (ancien / "comptes-rendus.sqlite").read_bytes() == avant


@pytest.mark.parametrize("options", [(), ("--garder-ids", "--correspondance", "x.json")])
def test_il_faut_choisir_la_traduction_des_identifiants(ancien, db, options):
    with pytest.raises(CommandError):
        call_command("importer_flask", "--source", str(ancien), *options)


def test_l_export_rend_les_donnees_a_l_ancien_service(ancien, tmp_path, db):
    _importer(ancien, tmp_path, "--garder-ids")
    cible = tmp_path / "retour"
    sortie = StringIO()
    call_command("exporter_flask", "--cible", str(cible), stdout=sortie)
    # bb22, restee vide, n'a jamais ete reprise : elle manque aussi au retour.
    assert "brouillons : 2, suppressions : 1, photos : 1, photos_absentes : 1" in sortie.getvalue()
    cx = sqlite3.connect(cible / "comptes-rendus.sqlite")
    lignes = dict(((u, i), (json.loads(c), m)) for u, i, c, m in cx.execute("SELECT * FROM brouillons"))
    assert lignes[("ancien-a", "b1")][0]["titre"] == "Session fictive"
    assert lignes[("ancien-b", "b2")][1] == "2026-01-03T10:00:00.000Z"
    assert cx.execute("SELECT * FROM supprimes").fetchall() == [
        ("ancien-a", "b9", "2026-01-01T00:00:00.000Z")]
    cx.close()
    assert (cible / "photos" / "aa11.jpg").read_bytes() == b"\xff\xd8photo"


def test_l_export_refuse_un_dossier_non_vide(tmp_path, db):
    (tmp_path / "plein").mkdir()
    (tmp_path / "plein" / "x").write_text("x")
    with pytest.raises(CommandError):
        call_command("exporter_flask", "--cible", str(tmp_path / "plein"))
