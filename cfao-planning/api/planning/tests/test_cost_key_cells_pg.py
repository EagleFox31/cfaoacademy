"""Écritures réellement concurrentes : SQLite ne verrouille pas les lignes, seul Postgres prouve.

python -m pytest planning/tests/test_cost_key_cells_pg.py -q --ds=config.settings.test_pg
"""
import threading

import pytest
from django.db import connection

from planning.imports.seat_sheets import SeatSheetsImporter
from planning.models import CostKeyStatus, PlannedAllocation, PlannedCellEdit, PlannedSession
from planning.services.cost_key_cells import CellConflict, edit_cell
from planning.services.cost_key_freeze import freeze, inputs_sha256
from planning.models import FrozenKeyError

from .test_import_seat_sheets import TS03, run, workbook, world  # noqa: F401

pytestmark = pytest.mark.django_db(transaction=True)

SHEETS = {"CAMEROUN": [TS03], "RCI": [TS03[:7] + [2]]}


@pytest.fixture(autouse=True)
def postgres_only():
    if connection.vendor != "postgresql":
        pytest.skip("Le verrou de ligne n'existe que sur Postgres.")


@pytest.fixture
def planned(world):  # noqa: F811
    run(SHEETS)
    session = PlannedSession.objects.get()
    return {**world, "alloc": session.allocations.get(country=world["cm"]),
            "alloc_ci": session.allocations.get(country=world["ci"])}


def race(*jobs):
    barrier = threading.Barrier(len(jobs))
    outcomes = [None] * len(jobs)

    def runner(index, job):
        try:
            barrier.wait(timeout=20)
            outcomes[index] = job()
        except Exception as exc:  # noqa: BLE001 — chaque issue est examinée par le test
            outcomes[index] = exc
        finally:
            connection.close()

    threads = [threading.Thread(target=runner, args=(i, job)) for i, job in enumerate(jobs)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=60)
    assert not any(t.is_alive() for t in threads), "interblocage"
    return outcomes


def setter(planned, value, alloc="alloc", expected=3):
    def job():
        return edit_cell(planned["key"].pk, target="allocation", target_id=planned[alloc].pk,
                         field="seats", expected=expected, value=value, actor=f"u_{value}")
    return job


def test_meme_cellule_un_seul_gagnant(planned):
    outcomes = race(*[setter(planned, value) for value in range(10, 22)])
    winners = [o for o in outcomes if not isinstance(o, Exception)]
    losers = [o for o in outcomes if isinstance(o, CellConflict)]
    assert (len(winners), len(losers)) == (1, 11), outcomes
    assert PlannedCellEdit.objects.count() == 1
    assert PlannedAllocation.objects.get(pk=planned["alloc"].pk).seats == winners[0].value


def test_cellules_differentes_aucune_perdue(planned):
    outcomes = race(setter(planned, 5), setter(planned, 6, alloc="alloc_ci", expected=2))
    assert not [o for o in outcomes if isinstance(o, Exception)], outcomes
    assert PlannedAllocation.objects.get(pk=planned["alloc"].pk).seats == 5
    assert PlannedAllocation.objects.get(pk=planned["alloc_ci"].pk).seats == 6


@pytest.mark.parametrize("attempt", range(5))
def test_saisie_contre_gel_jamais_apres_le_gel(planned, attempt):
    edit, snapshot = race(setter(planned, 5), lambda: freeze(planned["key"], actor="u_gel"))
    assert not isinstance(snapshot, Exception), snapshot
    assert edit.__class__ is FrozenKeyError or edit.changed
    planned["key"].refresh_from_db()
    assert planned["key"].status == CostKeyStatus.FROZEN
    assert snapshot.inputs_sha256 == inputs_sha256(planned["key"])


@pytest.mark.parametrize("attempt", range(5))
def test_saisie_contre_import_issue_coherente(planned, attempt):
    importer = SeatSheetsImporter()
    result = importer.parse(workbook({"CAMEROUN": [TS03[:7] + [9]], "RCI": [TS03[:7] + [2]]}))
    edit, log = race(setter(planned, 5), lambda: importer.apply(result))
    assert not isinstance(log, Exception), log
    seats = PlannedAllocation.objects.get(pk=planned["alloc"].pk).seats
    if isinstance(edit, CellConflict):
        assert seats == 9  # l'import est passé d'abord : la saisie a été refusée
    else:
        assert seats == 5 and edit.changed  # la saisie d'abord : l'import l'a conservée
