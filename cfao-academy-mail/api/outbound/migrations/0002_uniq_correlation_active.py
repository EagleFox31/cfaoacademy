from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("outbound", "0001_initial"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="outboundmessage",
            constraint=models.UniqueConstraint(
                condition=models.Q(correlation_id__isnull=False) & ~models.Q(status="REJECTED"),
                fields=("correlation_id",),
                name="uniq_mail_correlation_active",
            ),
        ),
    ]
