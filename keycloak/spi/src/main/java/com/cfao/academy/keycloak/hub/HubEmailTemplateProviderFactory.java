package com.cfao.academy.keycloak.hub;

import java.time.Duration;
import java.util.List;

import org.jboss.logging.Logger;
import org.keycloak.Config;
import org.keycloak.email.EmailTemplateProvider;
import org.keycloak.email.EmailTemplateProviderFactory;
import org.keycloak.email.freemarker.FreeMarkerEmailTemplateProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.provider.ProviderConfigurationBuilder;

/**
 * Fournisseur `cfao-hub` du SPI email-template.
 * Options : KC_SPI_EMAIL_TEMPLATE__CFAO_HUB__URL et __SERVICE_KEY.
 * Sans URL ni clé, Keycloak garde ses propres mails (module déployé sans hub).
 */
public class HubEmailTemplateProviderFactory implements EmailTemplateProviderFactory {

    public static final String ID = "cfao-hub";
    private static final Logger LOG = Logger.getLogger(HubEmailTemplateProviderFactory.class);

    private HubClient hub;

    @Override
    public EmailTemplateProvider create(KeycloakSession session) {
        return hub == null ? new FreeMarkerEmailTemplateProvider(session) : new HubEmailTemplateProvider(session, hub);
    }

    @Override
    public void init(Config.Scope config) {
        hub = configure(config.get("url"), config.get("service-key"),
                config.getInt("connect-timeout-ms", 2000), config.getInt("request-timeout-ms", 5000));
    }

    /** Client du hub partagé avec la connexion par mail ; null si le hub n'est pas configuré. */
    public HubClient hub() {
        return hub;
    }

    static HubClient configure(String url, String key, int connectMs, int requestMs) {
        boolean hasUrl = url != null && !url.isBlank();
        boolean hasKey = key != null && !key.isBlank();
        if (!hasUrl && !hasKey) {
            LOG.warn("cfao-hub : URL et clé absentes, les mails restent ceux de Keycloak.");
            return null;
        }
        if (!hasUrl || !hasKey) {
            // Configuration à moitié faite : refuser de démarrer plutôt que perdre les mails.
            throw new IllegalStateException("cfao-hub : url et service-key vont ensemble.");
        }
        return new HubClient(url, key, Duration.ofMillis(connectMs), Duration.ofMillis(requestMs));
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) {
    }

    @Override
    public void close() {
    }

    @Override
    public String getId() {
        return ID;
    }

    @Override
    public List<ProviderConfigProperty> getConfigMetadata() {
        return ProviderConfigurationBuilder.create()
                .property().name("url").type("string").helpText("Adresse du hub cfao-academy-mail").add()
                .property().name("service-key").type("password").helpText("Clé liée à la source cfao-identity").add()
                .property().name("connect-timeout-ms").type("int").defaultValue(2000).add()
                .property().name("request-timeout-ms").type("int").defaultValue(5000).add()
                .build();
    }
}
