"""La carrosserie devient une rubrique à part, à côté de Technique et Process.

Elle ne se décline pas par marque — elle couvre tous les véhicules — et occupe
donc sa propre ligne pleine largeur à l'écran plutôt qu'une demi-carte à côté
d'Equipment.
"""
from django.db import migrations, models


def forwards(apps, schema_editor):
    CatalogFamily = apps.get_model("referential", "CatalogFamily")
    CatalogFamily.objects.filter(pole="CARROSSERIE").update(section="CARROSSERIE")


def backwards(apps, schema_editor):
    CatalogFamily = apps.get_model("referential", "CatalogFamily")
    CatalogFamily.objects.filter(section="CARROSSERIE").update(section="TECHNIQUE")


class Migration(migrations.Migration):

    dependencies = [
        ('referential', '0003_sections_and_yamaha_motors'),
    ]

    operations = [
        migrations.AlterField(
            model_name='catalogfamily',
            name='section',
            field=models.CharField(choices=[('TECHNIQUE', 'Formation Technique'), ('CARROSSERIE', 'Formation en Réparation Carrosserie Tous véhicules'), ('PROCESS', 'Formation en Organisation SAV Process et Parts')], default='TECHNIQUE', max_length=16),
        ),
        migrations.RunPython(forwards, backwards),
    ]
