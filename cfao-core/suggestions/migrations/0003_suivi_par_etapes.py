import django.core.validators
from django.db import migrations, models


def traitee_vers_lue(apps, schema_editor):
    """Ancien statut « traitee » (prise en compte) → étape « lue », date conservée."""
    Suggestion = apps.get_model("suggestions", "PortalSuggestion")
    for obj in Suggestion.objects.filter(statut="traitee"):
        obj.statut = "lue"
        obj.etape_le = obj.lue_le
        obj.save(update_fields=["statut", "etape_le"])


def lue_vers_traitee(apps, schema_editor):
    Suggestion = apps.get_model("suggestions", "PortalSuggestion")
    Suggestion.objects.exclude(statut="nouvelle").update(statut="traitee")


class Migration(migrations.Migration):

    dependencies = [
        ("suggestions", "0002_portalsuggestion_type"),
    ]

    operations = [
        migrations.RenameField("portalsuggestion", "traitee_par", "suivie_par"),
        migrations.RenameField("portalsuggestion", "traitee_le", "lue_le"),
        migrations.AlterField(
            model_name="portalsuggestion",
            name="statut",
            field=models.CharField(
                choices=[
                    ("nouvelle", "Envoyée"), ("lue", "Lue"), ("planifiee", "Planifiée"),
                    ("en_ligne", "En ligne"), ("non_retenue", "Non retenue"),
                ],
                default="nouvelle", max_length=12,
            ),
        ),
        migrations.AddField("portalsuggestion", "etape_le", models.DateTimeField(blank=True, null=True)),
        migrations.AddField("portalsuggestion", "planifiee_le", models.DateTimeField(blank=True, null=True)),
        migrations.AddField("portalsuggestion", "en_ligne_le", models.DateTimeField(blank=True, null=True)),
        migrations.AddField("portalsuggestion", "non_retenue_le", models.DateTimeField(blank=True, null=True)),
        migrations.AddField("portalsuggestion", "echeance", models.DateField(blank=True, null=True)),
        migrations.AddField(
            "portalsuggestion", "reponse_equipe",
            models.TextField(blank=True, default="", validators=[django.core.validators.MaxLengthValidator(500)]),
            preserve_default=False,
        ),
        migrations.RunPython(traitee_vers_lue, lue_vers_traitee),
    ]
