package com.cfao.academy.keycloak.hub;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

/** Mails de la connexion par code : corps produits et conformité au contrat du hub (^0.2). */
class HubMailLoginTest {

    static final Instant NOW = HubMailTest.NOW;
    static final String LINK = HubMailTest.LINK;

    static HubMail code() {
        return HubMail.loginCode("a.b@filiale.example", Locale.ENGLISH, "Awa", "Diop", "adiop", "u-1",
                "042917", 10, LINK, 30, NOW);
    }

    static HubMail alert() {
        return HubMail.supportAlert("support@cfao.example", " Inconnu@Filiale.example ", "Connexion par mail",
                "Aucun compte actif pour cette adresse", NOW);
    }

    @Test
    void loginCodeCarriesCodeLinkAndTheLongestDeadline() {
        Map<String, Object> body = code().payload();
        assertEquals(HubMail.LOGIN_CODE, body.get("kind"));
        assertEquals(List.of("a.b@filiale.example"), body.get("to"));
        assertEquals("en", body.get("locale"));
        assertEquals(LINK, body.get("module_url"));
        // Le lien (30 min) survit au code (10 min) : le mail reste utile jusqu'au lien.
        assertEquals("2026-11-16T20:30:00Z", body.get("expires_at"));
        assertEquals(Map.of("display_name", "Awa Diop", "code", "042917", "code_minutes", "10",
                "link_minutes", "30"), body.get("context"));
        assertNull(body.get("reply_to"));
    }

    @Test
    void neitherCodeNorLinkReachTheLogs() {
        String text = code().toString();
        assertFalse(text.contains("042917"));
        assertFalse(text.contains("SECRETTOKEN42"));
    }

    @Test
    void supportAlertIsOncePerAddressPerDayAndRepliesToTheUser() {
        Map<String, Object> body = alert().payload();
        assertEquals(HubMail.LOGIN_SUPPORT_ALERT, body.get("kind"));
        assertEquals(List.of("support@cfao.example"), body.get("to"));
        assertEquals("fr", body.get("locale"));
        assertNull(body.get("expires_at"));
        assertNull(body.get("module_url"));
        String id = (String) body.get("correlation_id");
        // Même adresse, casse et espaces près, même jour : même identifiant (dédoublonné par le hub).
        assertEquals(id, HubMail.supportAlert("support@cfao.example", "inconnu@filiale.example", "r", "p",
                NOW.plusSeconds(3 * 3600)).payload().get("correlation_id"));
        assertTrue(id.endsWith(":2026-11-16"), id);
        assertFalse(id.toLowerCase(Locale.ROOT).contains("inconnu"), "l'adresse n'apparaît pas en clair");
        assertTrue(id.length() <= 160);
    }

    @Test
    void loginCodeMatchesThePublishedSchema() throws IOException {
        JsonNode schema = HubMailContractTest.schemaFor(HubMailContractTest.spec(), HubMail.LOGIN_CODE);
        assertEquals(List.of(), HubMailContractTest.violations(schema, code().payload()));
        Set<String> secrets = new HashSet<>();
        schema.get("x-secret-context").forEach(s -> secrets.add(s.asText()));
        assertTrue(secrets.contains("code"), "le code n'est plus déclaré secret");
    }

    @Test
    @SuppressWarnings("unchecked")
    void supportAlertMatchesThePublishedSchema() throws IOException {
        JsonNode schema = HubMailContractTest.schemaFor(HubMailContractTest.spec(), HubMail.LOGIN_SUPPORT_ALERT);
        Map<String, Object> body = alert().payload();
        List<String> errors = new ArrayList<>();
        Set<String> allowed = new HashSet<>();
        schema.get("properties").fieldNames().forEachRemaining(allowed::add);
        body.keySet().stream().filter(k -> !allowed.contains(k)).forEach(k -> errors.add("champ refusé : " + k));
        schema.get("required").forEach(r -> {
            if (!body.containsKey(r.asText())) errors.add("champ manquant : " + r.asText());
        });
        Map<String, Object> context = (Map<String, Object>) body.get("context");
        schema.get("x-required-context").forEach(r -> {
            if (!context.containsKey(r.asText())) errors.add("contexte manquant : " + r.asText());
        });
        schema.at("/properties/context/properties").fields().forEachRemaining(e -> {
            JsonNode pattern = e.getValue().get("pattern");
            Object value = context.get(e.getKey());
            if (pattern != null && value != null && !String.valueOf(value).matches(pattern.asText())) {
                errors.add("format invalide : " + e.getKey());
            }
        });
        Set<String> sources = new HashSet<>();
        schema.get("x-allowed-sources").forEach(s -> sources.add(s.asText()));
        if (!sources.contains(String.valueOf(body.get("source_app")))) errors.add("source non autorisée");
        int max = schema.at("/properties/correlation_id/maxLength").asInt();
        if (((String) body.get("correlation_id")).length() > max) errors.add("correlation_id trop long");
        assertEquals(List.of(), errors);
    }
}
