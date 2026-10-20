"""Sections de familles et rattachement de Yamaha à Motors.

Le champ `section` arrive avec `TECHNIQUE` par défaut : correct pour les familles
techniques, faux pour les quatre familles Process. On les corrige ici plutôt que
d'attendre un re-seed, sinon un environnement déjà peuplé afficherait les process
dans la section technique jusqu'au prochain déploiement du référentiel.

Les clés sont écrites en dur et non déduites du préfixe « process- » : une
migration décrit les données **à un instant donné**, pas une règle qui devrait
survivre au prochain libellé.
"""
from django.db import migrations

PROCESS_KEYS = [
    "process-sav-motors",
    "process-parts-motors",
    "process-sav-equipment",
    "process-parts-equipment",
]


def forwards(apps, schema_editor):
    CatalogFamily = apps.get_model("referential", "CatalogFamily")
    Brand = apps.get_model("referential", "Brand")

    CatalogFamily.objects.filter(key__in=PROCESS_KEYS).update(section="PROCESS")
    CatalogFamily.objects.filter(key="techniques-yamaha").update(pole="MOBILITY")
    Brand.objects.filter(code="yamaha").update(pole="MOBILITY")


def backwards(apps, schema_editor):
    CatalogFamily = apps.get_model("referential", "CatalogFamily")
    Brand = apps.get_model("referential", "Brand")

    CatalogFamily.objects.filter(key__in=PROCESS_KEYS).update(section="TECHNIQUE")
    CatalogFamily.objects.filter(key="techniques-yamaha").update(pole="AUTRE")
    Brand.objects.filter(code="yamaha").update(pole="AUTRE")


class Migration(migrations.Migration):

    dependencies = [
        ("referential", "0002_catalogfamily_section_alter_brand_pole_and_more"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
