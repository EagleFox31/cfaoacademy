"""Comptes formateurs à créer dans le realm commun, au format des profils locaux.

Sortie lue par `keycloak/migration/migrer_comptes.py --cr-profils` (création
idempotente, mot de passe temporaire à changer à la première connexion) :

    python manage.py export_trainer_accounts --avec /data/profils.json > comptes.json

`--avec` ajoute les profils locaux des comptes rendus (gardés tels quels, leur
identifiant est indexé par les comptes rendus) et écarte les fiches qu'ils
couvrent déjà, pour qu'une personne n'ait qu'un compte.
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand

from ...trainer_accounts import account_profiles


class Command(BaseCommand):
    help = "Exporte les comptes formateurs manquants (format profils locaux)."

    def add_arguments(self, parser):
        parser.add_argument("--avec", type=Path, help="profils locaux des comptes rendus à inclure")

    def handle(self, *args, **options):
        existing = json.loads(options["avec"].read_text(encoding="utf-8")) if options["avec"] else []
        self.stdout.write(json.dumps(existing + account_profiles(existing), ensure_ascii=False, indent=1))
