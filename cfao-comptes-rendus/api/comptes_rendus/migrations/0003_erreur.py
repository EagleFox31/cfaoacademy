from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('comptes_rendus', '0002_revision_supprimee'),
    ]

    operations = [
        migrations.CreateModel(
            name='Erreur',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('le', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('origine', models.CharField(max_length=10)),
                ('owner', models.CharField(blank=True, default='', max_length=128)),
                ('nom', models.CharField(blank=True, default='', max_length=160)),
                ('action', models.CharField(max_length=120)),
                ('message', models.TextField(blank=True, default='')),
                ('detail', models.TextField(blank=True, default='')),
                ('contexte', models.JSONField(blank=True, default=dict)),
            ],
            options={'ordering': ['-le']},
        ),
    ]
