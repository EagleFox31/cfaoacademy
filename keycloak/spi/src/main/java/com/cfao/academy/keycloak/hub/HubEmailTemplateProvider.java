package com.cfao.academy.keycloak.hub;

import java.time.Instant;

import org.keycloak.email.EmailException;
import org.keycloak.email.freemarker.FreeMarkerEmailTemplateProvider;
import org.keycloak.models.KeycloakSession;

/**
 * Mails d'action de Keycloak (mot de passe oublié, actions demandées par un admin,
 * vérification d'adresse) envoyés par le hub cfao-academy-mail. Les autres mails
 * restent ceux de Keycloak.
 */
public class HubEmailTemplateProvider extends FreeMarkerEmailTemplateProvider {

    private final HubClient hub;

    public HubEmailTemplateProvider(KeycloakSession session, HubClient hub) {
        super(session);
        this.hub = hub;
    }

    @Override
    public void sendPasswordReset(String link, long expirationInMinutes) throws EmailException {
        enqueue(HubMail.PASSWORD_RESET, link, expirationInMinutes);
    }

    @Override
    public void sendExecuteActions(String link, long expirationInMinutes) throws EmailException {
        enqueue(HubMail.EXECUTE_ACTIONS, link, expirationInMinutes);
    }

    @Override
    public void sendVerifyEmail(String link, long expirationInMinutes) throws EmailException {
        enqueue(HubMail.VERIFY_EMAIL, link, expirationInMinutes);
    }

    private void enqueue(String kind, String link, long minutes) throws EmailException {
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            // Même refus que le fournisseur de Keycloak : rien à envoyer.
            throw new EmailException("Utilisateur sans adresse mail");
        }
        hub.enqueue(HubMail.link(kind, user.getEmail(), session.getContext().resolveLocale(user),
                user.getFirstName(), user.getLastName(), user.getUsername(), user.getId(),
                link, minutes, Instant.now()));
    }
}
