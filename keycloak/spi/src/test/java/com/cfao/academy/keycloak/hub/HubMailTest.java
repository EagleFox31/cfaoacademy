package com.cfao.academy.keycloak.hub;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.junit.jupiter.api.Test;

class HubMailTest {

    static final Instant NOW = Instant.parse("2026-11-16T20:00:00.250Z");
    static final String LINK = "https://academy.example/auth/realms/cfao/login-actions/action-token?key=SECRETTOKEN42";

    static HubMail reset(Locale locale, long minutes) {
        return HubMail.link(HubMail.PASSWORD_RESET, "a.b@filiale.example", locale, "Awa", "Diop", "adiop",
                "u-1", LINK, minutes, NOW);
    }

    @Test
    void payloadCarriesTheLinkAsModuleUrlAndTheDeliveryDeadline() {
        Map<String, Object> body = reset(Locale.FRENCH, 5).payload();
        assertEquals("identity.password_reset", body.get("kind"));
        assertEquals("cfao-identity", body.get("source_app"));
        assertEquals("user:u-1", body.get("source_ref"));
        assertEquals(List.of("a.b@filiale.example"), body.get("to"));
        assertEquals("fr", body.get("locale"));
        assertEquals(LINK, body.get("module_url"));
        assertEquals("2026-11-16T20:05:00Z", body.get("expires_at"));
        assertEquals(Map.of("display_name", "Awa Diop", "link_minutes", "5"), body.get("context"));
        assertNull(body.get("cc"));
    }

    @Test
    void languageFallsBackToFrench() {
        assertEquals("pt", HubMail.language(Locale.forLanguageTag("pt-BR")));
        assertEquals("en", HubMail.language(Locale.UK));
        assertEquals("fr", HubMail.language(Locale.GERMAN));
        assertEquals("fr", HubMail.language(null));
    }

    @Test
    void displayNameFallsBackToUsername() {
        assertEquals("Awa", HubMail.displayName(" Awa ", null, "adiop"));
        assertEquals("adiop", HubMail.displayName(" ", null, "adiop"));
    }

    @Test
    void minutesStayWithinWhatTheHubAccepts() {
        assertEquals("1", ctx(reset(Locale.FRENCH, 0)).get("link_minutes"));
        assertEquals("9999", ctx(reset(Locale.FRENCH, 20160)).get("link_minutes"));
        // Lien de 14 jours : le hub n'attend pas plus de 24 h pour le remettre.
        assertEquals("2026-11-17T20:00:00Z", reset(Locale.FRENCH, 20160).payload().get("expires_at"));
    }

    @Test
    void theLinkNeverReachesTheLogs() {
        assertFalse(reset(Locale.FRENCH, 5).toString().contains("SECRETTOKEN42"));
    }

    @Test
    void halfConfiguredHubRefusesToStart() {
        assertNull(HubEmailTemplateProviderFactory.configure(null, " ", 2000, 5000));
        assertThrows(IllegalStateException.class,
                () -> HubEmailTemplateProviderFactory.configure("http://mail-api:5180", "", 2000, 5000));
        assertThrows(IllegalStateException.class,
                () -> HubEmailTemplateProviderFactory.configure(null, "key", 2000, 5000));
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> ctx(HubMail mail) {
        return (Map<String, Object>) mail.payload().get("context");
    }
}
