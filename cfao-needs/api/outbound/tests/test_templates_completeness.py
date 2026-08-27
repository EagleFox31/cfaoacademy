"""Une traduction manquante fait échouer la CI — jamais un repli silencieux.

C'est la règle de la story 14-16 et de la spec §7.2. Sans ce test, un message
part en français à un destinataire anglophone sans que personne ne le voie : à
Academix, ce défaut a coûté six pull requests correctives (F19).
"""
import pytest
from django.core.management import call_command

from outbound.catalog import MESSAGE_TYPES
from outbound.management.commands.seed_email_templates import LOCALES, TEMPLATES
from outbound.models import EmailTemplate
from outbound.services.render import MissingTranslation, greeting, resolve_template

pytestmark = pytest.mark.django_db


def test_chaque_type_de_message_a_un_modele():
    """Ajouter un type au catalogue sans son modèle doit casser ici, pas en production."""
    attendus = {m.subject_key for m in MESSAGE_TYPES}
    manquants = sorted(attendus - set(TEMPLATES))
    assert manquants == [], f"types de message sans modèle : {manquants}"


def test_chaque_modele_existe_dans_les_deux_langues():
    for key, per_locale in TEMPLATES.items():
        manquantes = [loc for loc in LOCALES if loc not in per_locale]
        assert manquantes == [], f"« {key} » n'existe pas en {manquantes}"
        for locale in LOCALES:
            subject, body = per_locale[locale]
            assert subject.strip(), f"objet vide : {key}/{locale}"
            assert body.strip(), f"corps vide : {key}/{locale}"


def test_le_seed_charge_toutes_les_langues():
    call_command("seed_email_templates", verbosity=0)

    attendu = len(TEMPLATES) * len(LOCALES)
    assert EmailTemplate.objects.count() == attendu

    for message_type in MESSAGE_TYPES:
        for locale in LOCALES:
            template = resolve_template(message_type.subject_key, locale)
            assert template.version == 1


def test_le_seed_est_rejouable_sans_dupliquer():
    call_command("seed_email_templates", verbosity=0)
    premier = EmailTemplate.objects.count()
    call_command("seed_email_templates", verbosity=0)
    assert EmailTemplate.objects.count() == premier


def test_une_locale_absente_leve_une_erreur_explicite():
    call_command("seed_email_templates", verbosity=0)
    with pytest.raises(MissingTranslation) as exc:
        resolve_template("submission.confirmed", "pt")
    assert "submission.confirmed" in str(exc.value)


def test_la_civilite_par_defaut_ne_suppose_pas_le_genre():
    """« NEUTRE » est la valeur par défaut : on n'invente jamais le genre de quelqu'un."""
    assert greeting("NEUTRE", "Awa Diallo", "fr") == "Awa Diallo"
    assert greeting("M", "Awa Diallo", "fr") == "Monsieur Awa Diallo"
    assert greeting("MME", "Awa Diallo", "en") == "Ms Awa Diallo"
    assert greeting("", "", "fr") == "Bonjour"
    assert greeting("", "", "en") == "Hello"
