from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("suggestions", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="portalsuggestion",
            name="type",
            field=models.CharField(blank=True, default="", max_length=60),
            preserve_default=False,
        ),
    ]
