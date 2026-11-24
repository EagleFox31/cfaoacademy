package com.cfao.academy.keycloak.login;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

import org.jboss.logging.Logger;

/** Réglages de la connexion par mail, lus une fois au démarrage. */
record MailLoginSettings(String supportEmail, byte[] pepper, SecureRandom random) {

    private static final Logger LOG = Logger.getLogger(MailLoginSettings.class);
    static final int MIN_PEPPER_LENGTH = 32;

    static MailLoginSettings of(String supportEmail, String pepper) {
        SecureRandom random = new SecureRandom();
        String support = supportEmail == null || supportEmail.isBlank() ? null : supportEmail.trim();
        if (support == null) {
            LOG.warn("cfao-mail : support-email absent, aucune alerte support ne partira.");
        }
        byte[] key;
        if (pepper == null || pepper.isBlank()) {
            // Sans poivre partagé, un code n'est vérifiable que sur le nœud qui l'a émis.
            LOG.warn("cfao-mail : code-pepper absent, poivre aléatoire propre à ce nœud.");
            key = new byte[MIN_PEPPER_LENGTH];
            random.nextBytes(key);
        } else {
            if (pepper.length() < MIN_PEPPER_LENGTH) {
                throw new IllegalStateException("cfao-mail : code-pepper doit compter au moins "
                        + MIN_PEPPER_LENGTH + " caractères.");
            }
            key = pepper.getBytes(StandardCharsets.UTF_8);
        }
        return new MailLoginSettings(support, key, random);
    }

    @Override
    public String toString() {
        return "MailLoginSettings[support=" + (supportEmail != null) + "]";
    }
}
