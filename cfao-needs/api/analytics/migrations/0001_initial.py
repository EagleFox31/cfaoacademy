from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="NeedsState",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, primary_key=True, serialize=False)),
                ("version", models.BigIntegerField(default=0)),
                ("updated_at", models.DateTimeField(blank=True, null=True)),
            ],
        ),
        migrations.CreateModel(
            name="NeedsOutbox",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False,
                                           verbose_name="ID")),
                ("version", models.BigIntegerField(unique=True)),
                ("created_at", models.DateTimeField()),
                ("next_attempt_at", models.DateTimeField()),
                ("attempts", models.PositiveIntegerField(default=0)),
                ("delivered_at", models.DateTimeField(blank=True, null=True)),
                ("last_error", models.CharField(blank=True, default="", max_length=255)),
            ],
            options={
                "indexes": [models.Index(fields=["delivered_at", "next_attempt_at"],
                                         name="needs_outbox_due")],
            },
        ),
    ]
