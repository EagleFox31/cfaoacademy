from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0007_needline_postponed"),
    ]

    operations = [
        migrations.AddField(
            model_name="needline",
            name="unassigned",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
