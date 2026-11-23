import os

import pytest
from django.core.management import call_command

from core.models import ImportLog
from planning.management.commands.load_workbooks import discover
from planning.models import PlannedSession

from .test_import_seat_sheets import TS03, workbook
from .test_import_seat_sheets import world  # noqa: F401  (fixture)

pytestmark = pytest.mark.django_db


def _write(path, data=b"x", mtime=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    if mtime:
        os.utime(path, (mtime, mtime))
    return path


def test_discover_prend_la_derniere_version_et_ignore_verrous_et_historique(tmp_path):
    _write(tmp_path / "2026" / "Plannings formateurs 2026 V9.xlsx")
    v27 = _write(tmp_path / "2026" / "Plannings formateurs 2026 V27.xlsx")
    _write(tmp_path / "2026" / "~$Plannings formateurs 2026 V28.xlsx")
    _write(tmp_path / "2026" / "Historique" / "Plannings formateurs 2026 V30.xlsx")
    cle = _write(tmp_path / "Clé de Répartition 2026 MOTORS.xlsm")
    _write(tmp_path / "Synthese besoins.xlsx")

    plan = discover([tmp_path, tmp_path / "absent"])

    assert plan == [("seat_allocations", cle, {}), ("calendar_grid", v27, {"year": "2026"}),
                    ("forecast_grid", v27, {"year": "2026"})]


def test_dossier_illisible_signale_au_lieu_de_rien_charger_en_silence(tmp_path, monkeypatch, capsys):
    """Partage du serveur en drwx--S--- : sans droit de lecture, le dire dans le journal."""
    _write(tmp_path / "Clé de Répartition 2026 MOTORS.xlsm")
    vrai_access = os.access
    monkeypatch.setattr(
        "planning.management.commands.load_workbooks.os.access",
        lambda p, mode: False if str(p) == str(tmp_path) else vrai_access(p, mode),
    )

    assert discover([tmp_path]) == []
    call_command("load_workbooks", str(tmp_path))
    assert f"Dossier illisible (droits), ignoré : {tmp_path}" in capsys.readouterr().out


def test_chargement_au_demarrage_puis_second_passage_sans_ecriture(world, tmp_path, monkeypatch):
    _write(tmp_path / "Repartition de places par PAYS MOTORS 2026 (v5).xlsm",
           workbook({"RCI": [TS03]}).getvalue())
    _write(tmp_path / "Clé de Répartition illisible 2026.xlsm", b"pas un classeur")
    monkeypatch.setenv("PLANNING_WORKBOOKS_DIRS", f"{tmp_path}:{tmp_path / 'absent'}")
    monkeypatch.setenv("PLANNING_CLOSED_YEARS", "2026")

    call_command("load_workbooks")

    assert PlannedSession.objects.count() == 1
    statuses = sorted(ImportLog.objects.values_list("status", flat=True))
    assert statuses == [ImportLog.Status.APPLIED, ImportLog.Status.REJECTED]
    world["key"].refresh_from_db()
    assert world["key"].is_frozen

    call_command("load_workbooks")
    assert ImportLog.objects.count() == 2
