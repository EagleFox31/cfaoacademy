"""Suzuki : le palier Senior porte le nom Silver dans le barème de la marque.

Seules les lignes encore au libellé de repli changent : un niveau corrigé depuis
l'écran reste tel quel, et un second passage ne modifie rien.
"""
from django.db import migrations


def to_silver(apps, schema_editor):
    lines = apps.get_model("campaigns", "CatalogLine").objects
    lines.filter(brand__label__iexact="SUZUKI", level_label="Senior").update(level_label="Silver")


class Migration(migrations.Migration):

    dependencies = [("campaigns", "0005_place_distanciel")]

    operations = [migrations.RunPython(to_silver, migrations.RunPython.noop)]
