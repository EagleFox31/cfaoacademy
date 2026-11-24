from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('planning', '0009_places_offertes_auteur_import'),
    ]

    operations = [
        migrations.AddField(
            model_name='plannedsession',
            name='start_moved',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='plannedsession',
            name='source_start_date',
            field=models.DateField(blank=True, null=True),
        ),
    ]
