"""L'attente du schéma protège le démarrage du worker.

Découvert au premier `docker compose up` : le worker démarrait avant `make migrate`
et bouclait sur `relation "django_q_ormq" does not exist`, avec des lignes
`CRITICAL reincarnated pusher after sudden death` dans les journaux. Il finissait
par se remettre, mais un exploitant qui lit ça croit la stack cassée.
"""
import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

pytestmark = pytest.mark.django_db


def test_rend_la_main_quand_les_tables_existent(capsys):
    call_command("wait_for_schema", "django_q_ormq")
    assert "Schéma disponible" in capsys.readouterr().out


def test_accepte_plusieurs_tables():
    call_command("wait_for_schema", "django_q_ormq", "campaigns_campaign", "referential_brand")


def test_expire_avec_un_message_actionnable():
    """Sans délai d'expiration, un worker mal configuré attendrait indéfiniment
    sans que personne ne sache pourquoi."""
    with pytest.raises(CommandError) as exc:
        call_command("wait_for_schema", "table_inexistante", "--timeout", "0", "--interval", "1")

    message = str(exc.value)
    assert "table_inexistante" in message
    assert "make migrate" in message
