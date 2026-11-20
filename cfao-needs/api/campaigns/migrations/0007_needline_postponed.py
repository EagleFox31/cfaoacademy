from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0006_suzuki_senior_silver"),
    ]

    operations = [
        migrations.AddField(
            model_name="needline",
            name="postponed",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
