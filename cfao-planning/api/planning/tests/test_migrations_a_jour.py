"""Un modèle modifié sans migration passe les tests (base de test créée depuis
les modèles) mais laisse la prod en retard : le job migrate n'a rien à appliquer."""
import io

import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_aucune_migration_manquante():
    out = io.StringIO()
    try:
        call_command("makemigrations", "--check", "--dry-run", stdout=out, stderr=out)
    except SystemExit:
        pytest.fail(f"Migrations manquantes :\n{out.getvalue()}")
