"""Le trigger de version des besoins suit aussi `unassigned` (places non attribuées).

Recrée le seul trigger UPDATE de `campaigns_needline` avec la nouvelle colonne dans
sa clause WHEN ; les autres tables et la fonction ne changent pas.
"""
from importlib import import_module

from django.db import migrations

_previous = import_module("analytics.migrations.0002_needs_version_trigger")
_PREVIOUS, _row = _previous.WATCHED, _previous._row

TABLE = "campaigns_needline"
COLUMNS = ["q1", "q2", "q3", "q4", "postponed", "unassigned", "catalog_line_id", "submission_id"]


def _recreate(schema_editor, cols: list[str]) -> None:
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(f"DROP TRIGGER IF EXISTS {TABLE}_needs_version_update ON {TABLE}")
    schema_editor.execute(f"""
        CREATE CONSTRAINT TRIGGER {TABLE}_needs_version_update
        AFTER UPDATE ON {TABLE}
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
        WHEN ({_row('OLD', cols)} IS DISTINCT FROM {_row('NEW', cols)})
        EXECUTE FUNCTION analytics_bump_needs_version()""")


def _forward(apps, schema_editor):
    _recreate(schema_editor, COLUMNS)


def _backward(apps, schema_editor):
    _recreate(schema_editor, _PREVIOUS[TABLE])


class Migration(migrations.Migration):

    dependencies = [
        ("analytics", "0002_needs_version_trigger"),
        ("campaigns", "0008_needline_unassigned"),
    ]

    operations = [migrations.RunPython(_forward, _backward)]
