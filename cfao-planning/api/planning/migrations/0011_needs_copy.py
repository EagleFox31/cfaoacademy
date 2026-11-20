from django.db import migrations, models


def _singleton(apps, schema_editor):
    apps.get_model("planning", "NeedsCopyState").objects.get_or_create(pk=1)


class Migration(migrations.Migration):

    dependencies = [
        ("planning", "0010_planned_session_start_moved"),
    ]

    operations = [
        migrations.CreateModel(
            name="NeedsCopyState",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, primary_key=True, serialize=False)),
                ("version", models.BigIntegerField(blank=True, null=True)),
                ("generated_at", models.DateTimeField(blank=True, null=True)),
                ("received_at", models.DateTimeField(blank=True, null=True)),
            ],
        ),
        migrations.CreateModel(
            name="NeedsCopyYear",
            fields=[
                ("year", models.IntegerField(primary_key=True, serialize=False)),
                ("version", models.BigIntegerField()),
                ("payload", models.JSONField()),
            ],
        ),
        migrations.RunPython(_singleton, migrations.RunPython.noop),
    ]
