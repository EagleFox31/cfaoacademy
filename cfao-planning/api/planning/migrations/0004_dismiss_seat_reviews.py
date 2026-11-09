"""Les feuilles pays alimentent désormais le prévisionnel : les éléments de revue
qu'elles ouvraient (rattachement à une session réalisée) n'ont plus d'objet."""
from django.db import migrations
from django.utils import timezone


def dismiss(apps, schema_editor):
    ReviewItem = apps.get_model("planning", "ReviewItem")
    ReviewItem.objects.filter(status="OPEN", import_log__kind="seat_allocations").update(
        status="DISMISSED",
        resolution={"superseded_by": "planned_import"},
        resolved_at=timezone.now(),
    )


class Migration(migrations.Migration):
    dependencies = [("planning", "0003_planned_and_freeze")]

    operations = [migrations.RunPython(dismiss, migrations.RunPython.noop)]
