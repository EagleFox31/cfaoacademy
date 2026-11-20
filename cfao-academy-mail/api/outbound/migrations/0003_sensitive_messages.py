"""Messages sensibles : contexte scellé, expiration, statut EXPIRED.

Additive : deux colonnes nullables et un choix de statut de plus. Aucune ligne
existante n'est réécrite.
"""
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("outbound", "0002_uniq_correlation_active"),
    ]

    operations = [
        migrations.AddField(
            model_name="outboundmessage",
            name="sealed_context",
            field=models.BinaryField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="outboundmessage",
            name="expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="outboundmessage",
            name="status",
            field=models.CharField(
                choices=[
                    ("PENDING_REVIEW", "À relire"),
                    ("APPROVED", "Approuvé"),
                    ("SENT", "Envoyé"),
                    ("FAILED", "Échec"),
                    ("REJECTED", "Rejeté"),
                    ("EXPIRED", "Expiré"),
                ],
                default="PENDING_REVIEW",
                max_length=20,
            ),
        ),
    ]
