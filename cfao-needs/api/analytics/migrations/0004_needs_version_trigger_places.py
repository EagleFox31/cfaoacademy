"""Le trigger de version des besoins suit aussi le lieu de chaque trimestre (`place_q1..4`).

Les places attribuées envoyées à cfao-planning en dépendent : un lieu changé seul doit
produire une nouvelle version.
"""
from importlib import import_module

from django.db import migrations

_previous = import_module("analytics.migrations.0003_needs_version_trigger_unassigned")
_recreate, _PREVIOUS = _previous._recreate, _previous.COLUMNS

COLUMNS = [*_PREVIOUS, "place_q1", "place_q2", "place_q3", "place_q4"]


def _forward(apps, schema_editor):
    _recreate(schema_editor, COLUMNS)


def _backward(apps, schema_editor):
    _recreate(schema_editor, _PREVIOUS)


class Migration(migrations.Migration):

    dependencies = [("analytics", "0003_needs_version_trigger_unassigned")]

    operations = [migrations.RunPython(_forward, _backward)]
