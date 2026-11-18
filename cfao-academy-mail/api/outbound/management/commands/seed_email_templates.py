from django.core.management.base import BaseCommand
from django.db import transaction

from outbound.catalog import LOCALES, MESSAGE_TYPES
from outbound.models import EmailTemplate

STUBS = {
    "rapports.cr_to_document": {
        "fr": (
            "Comptes rendus à rédiger",
            "$greeting,\n\nVous avez $pending_count compte(s) rendu(s) à finaliser.\n\n$module_url\n",
        ),
        "en": (
            "Training reports to complete",
            "$greeting,\n\nYou have $pending_count report(s) to complete.\n\n$module_url\n",
        ),
        "pt": (
            "Relatórios de formação por concluir",
            "$greeting,\n\nTem $pending_count relatório(s) por concluir.\n\n$module_url\n",
        ),
    },
    "rapports.cr_steps_missing": {
        "fr": (
            "Pages manquantes — $session_code",
            "$greeting,\n\nIl reste à compléter : $missing_pages\n\n$module_url\n",
        ),
        "en": (
            "Missing pages — $session_code",
            "$greeting,\n\nStill to complete: $missing_pages\n\n$module_url\n",
        ),
        "pt": (
            "Páginas em falta — $session_code",
            "$greeting,\n\nAinda por preencher: $missing_pages\n\n$module_url\n",
        ),
    },
    "rapports.cr_draft_stale": {
        "fr": (
            "Brouillon en attente — $session_code",
            "$greeting,\n\nVotre brouillon n'a pas été modifié depuis $days_inactive jours.\n\n$module_url\n",
        ),
        "en": (
            "Draft pending — $session_code",
            "$greeting,\n\nYour draft has been inactive for $days_inactive days.\n\n$module_url\n",
        ),
        "pt": (
            "Rascunho pendente — $session_code",
            "$greeting,\n\nO seu rascunho não é alterado há $days_inactive dias.\n\n$module_url\n",
        ),
    },
    "core.session_reminder": {
        "fr": (
            "Rappel session — $session_code",
            "$greeting,\n\nSession le $session_date à $session_place.\n",
        ),
        "en": (
            "Session reminder — $session_code",
            "$greeting,\n\nSession on $session_date at $session_place.\n",
        ),
        "pt": (
            "Lembrete de sessão — $session_code",
            "$greeting,\n\nSessão a $session_date em $session_place.\n",
        ),
    },
    # Le paragraphe qui commence par $code_display devient le bloc du code dans le HTML.
    # Jamais de secret dans l'objet : le hub le rend de toute façon sans les secrets.
    "identity.login_code": {
        "fr": (
            "Votre code de connexion",
            "$greeting,\n\nSur l'ordinateur où vous avez demandé la connexion, tapez ce code :\n\n"
            "$code_display\nValable $code_minutes minutes, une seule fois.\n\n"
            "Vous pouvez aussi cliquer sur le bouton (valable $link_minutes minutes). "
            "Une fois l'un utilisé, l'autre ne fonctionne plus.\n\n$module_url\n\n"
            "Vous n'avez rien demandé ? Ignorez ce mail.\n",
        ),
        "en": (
            "Your sign-in code",
            "$greeting,\n\nOn the computer where you asked to sign in, type this code:\n\n"
            "$code_display\nValid for $code_minutes minutes, single use.\n\n"
            "You can also click the button (valid for $link_minutes minutes). "
            "Once one is used, the other stops working.\n\n$module_url\n\n"
            "Didn't ask? Ignore this email.\n",
        ),
        "pt": (
            "O seu código de acesso",
            "$greeting,\n\nNo computador onde pediu o acesso, introduza este código:\n\n"
            "$code_display\nVálido durante $code_minutes minutos, uma única vez.\n\n"
            "Também pode clicar no botão (válido durante $link_minutes minutos). "
            "Depois de usar um, o outro deixa de funcionar.\n\n$module_url\n\n"
            "Não pediu nada? Ignore este e-mail.\n",
        ),
    },
    "identity.password_reset": {
        "fr": (
            "Choisir un nouveau mot de passe",
            "$greeting,\n\nVous avez demandé à changer votre mot de passe CFAO Academy. "
            "Cliquez sur le bouton pour en choisir un nouveau. "
            "Ce lien est valable $link_minutes minutes et ne sert qu'une fois.\n\n$module_url\n\n"
            "Vous n'avez rien demandé ? Ignorez ce mail : votre mot de passe ne change pas.\n",
        ),
        "en": (
            "Choose a new password",
            "$greeting,\n\nYou asked to change your CFAO Academy password. "
            "Click the button to choose a new one. "
            "This link is valid for $link_minutes minutes and works once.\n\n$module_url\n\n"
            "Didn't ask? Ignore this email: your password stays the same.\n",
        ),
        "pt": (
            "Escolher uma nova palavra-passe",
            "$greeting,\n\nPediu para alterar a sua palavra-passe CFAO Academy. "
            "Clique no botão para escolher uma nova. "
            "Esta ligação é válida durante $link_minutes minutos e só funciona uma vez.\n\n$module_url\n\n"
            "Não pediu nada? Ignore este e-mail: a sua palavra-passe não muda.\n",
        ),
    },
    "identity.execute_actions": {
        "fr": (
            "Mettre à jour votre compte",
            "$greeting,\n\nUn administrateur CFAO Academy vous demande de mettre à jour votre compte. "
            "Cliquez sur le bouton pour le faire. Ce lien est valable $link_minutes minutes.\n\n$module_url\n\n"
            "Vous n'attendiez pas ce mail ? Prévenez le support CFAO Academy.\n",
        ),
        "en": (
            "Update your account",
            "$greeting,\n\nA CFAO Academy administrator asks you to update your account. "
            "Click the button to do so. This link is valid for $link_minutes minutes.\n\n$module_url\n\n"
            "Not expecting this email? Tell CFAO Academy support.\n",
        ),
        "pt": (
            "Atualizar a sua conta",
            "$greeting,\n\nUm administrador CFAO Academy pede-lhe que atualize a sua conta. "
            "Clique no botão para o fazer. Esta ligação é válida durante $link_minutes minutos.\n\n$module_url\n\n"
            "Não esperava este e-mail? Avise o suporte CFAO Academy.\n",
        ),
    },
    "identity.verify_email": {
        "fr": (
            "Confirmer votre adresse mail",
            "$greeting,\n\nCliquez sur le bouton pour confirmer que cette adresse est bien la vôtre. "
            "Ce lien est valable $link_minutes minutes.\n\n$module_url\n\n"
            "Vous n'avez pas de compte CFAO Academy ? Ignorez ce mail.\n",
        ),
        "en": (
            "Confirm your email address",
            "$greeting,\n\nClick the button to confirm this address is yours. "
            "This link is valid for $link_minutes minutes.\n\n$module_url\n\n"
            "No CFAO Academy account? Ignore this email.\n",
        ),
        "pt": (
            "Confirmar o seu endereço de e-mail",
            "$greeting,\n\nClique no botão para confirmar que este endereço é seu. "
            "Esta ligação é válida durante $link_minutes minutos.\n\n$module_url\n\n"
            "Não tem conta CFAO Academy? Ignore este e-mail.\n",
        ),
    },
    "identity.login_support_alert": {
        "fr": (
            "Connexion sans suite : $entered_email",
            "$greeting,\n\nUne demande de connexion n'a pas abouti. "
            "Répondre à ce mail écrit directement à l'adresse saisie.\n\n"
            "Adresse saisie : $entered_email\nDemande : $request\nProblème : $problem\n",
        ),
        "en": (
            "Sign-in request without follow-up: $entered_email",
            "$greeting,\n\nA sign-in request did not go through. "
            "Replying to this email writes directly to the address entered.\n\n"
            "Address entered: $entered_email\nRequest: $request\nProblem: $problem\n",
        ),
        "pt": (
            "Pedido de acesso sem seguimento: $entered_email",
            "$greeting,\n\nUm pedido de acesso não foi concluído. "
            "Responder a este e-mail escreve diretamente para o endereço introduzido.\n\n"
            "Endereço introduzido: $entered_email\nPedido: $request\nProblema: $problem\n",
        ),
    },
}


class Command(BaseCommand):
    help = "Amorce les templates v1 (FR, EN, PT) pour le catalogue mail. Rejouable : n'écrase jamais."

    @transaction.atomic
    def handle(self, *args, **options):
        created = 0
        for message_type in MESSAGE_TYPES:
            key = message_type.subject_key
            stub = STUBS.get(key)
            for locale in LOCALES:
                if EmailTemplate.objects.filter(key=key, locale=locale).exists():
                    continue
                if stub:
                    subject, body = stub[locale]
                else:
                    subject = key.replace(".", " ").title()
                    body = f"$greeting,\n\n({key})\n"
                EmailTemplate.objects.create(
                    key=key,
                    locale=locale,
                    subject=subject,
                    body_text=body,
                    version=1,
                )
                created += 1
        self.stdout.write(self.style.SUCCESS(f"Templates créés : {created}"))
