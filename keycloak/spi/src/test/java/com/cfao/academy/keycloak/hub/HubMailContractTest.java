package com.cfao.academy.keycloak.hub;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.keycloak.util.JsonSerialization;

/**
 * Consommateur du contrat mail-outbound (contracts/registry.json, ^0.2) : chaque corps
 * produit par l'extension respecte le schéma publié par le hub pour son kind.
 * Lit le contrat du dépôt (propriété contract.spec) : échoue s'il est absent.
 */
class HubMailContractTest {

    static final Path SPEC = Path.of(System.getProperty("contract.spec",
            "../../cfao-academy-mail/api/outbound/contract/mail.openapi.json"));

    static JsonNode spec() throws IOException {
        return JsonSerialization.mapper.readTree(Files.readString(SPEC));
    }

    static JsonNode schemaFor(JsonNode spec, String kind) {
        for (JsonNode schema : spec.at("/components/schemas")) {
            if (schema.at("/properties/kind/enum/0").asText().equals(kind)) {
                return schema;
            }
        }
        throw new AssertionError("Kind absent du contrat : " + kind);
    }

    @ParameterizedTest
    @ValueSource(strings = {HubMail.PASSWORD_RESET, HubMail.EXECUTE_ACTIONS, HubMail.VERIFY_EMAIL})
    void payloadMatchesThePublishedSchema(String kind) throws IOException {
        JsonNode spec = spec();
        String version = spec.at("/info/version").asText();
        assertTrue(version.startsWith("0.") && Integer.parseInt(version.split("\\.")[1]) >= 2, version);
        JsonNode schema = schemaFor(spec, kind);
        Map<String, Object> body = HubMail.link(kind, "a.b@filiale.example", Locale.forLanguageTag("pt"),
                "Awa", "Diop", "adiop", "u-1", HubMailTest.LINK, 30, HubMailTest.NOW).payload();
        assertEquals(List.of(), violations(schema, body));
    }

    @SuppressWarnings("unchecked")
    static List<String> violations(JsonNode schema, Map<String, Object> body) {
        List<String> errors = new ArrayList<>();
        Set<String> allowed = new HashSet<>();
        schema.get("properties").fieldNames().forEachRemaining(allowed::add);
        body.keySet().stream().filter(k -> !allowed.contains(k)).forEach(k -> errors.add("champ refusé : " + k));
        schema.get("required").forEach(r -> {
            if (!body.containsKey(r.asText())) errors.add("champ manquant : " + r.asText());
        });
        Map<String, Object> context = (Map<String, Object>) body.get("context");
        schema.get("x-required-context").forEach(r -> {
            String field = r.asText();
            if (!context.containsKey(field) && !body.containsKey(field)) errors.add("contexte manquant : " + field);
        });
        schema.at("/properties/context/properties").fields().forEachRemaining(e -> {
            JsonNode pattern = e.getValue().get("pattern");
            Object value = context.get(e.getKey());
            if (pattern != null && value != null && !String.valueOf(value).matches(pattern.asText())) {
                errors.add("format invalide : " + e.getKey());
            }
        });
        Set<String> locales = new HashSet<>();
        schema.at("/properties/locale/enum").forEach(l -> locales.add(l.asText()));
        if (!locales.contains(String.valueOf(body.get("locale")))) errors.add("locale inconnue");
        Set<String> sources = new HashSet<>();
        schema.get("x-allowed-sources").forEach(s -> sources.add(s.asText()));
        if (!sources.contains(String.valueOf(body.get("source_app")))) errors.add("source non autorisée");
        Set<String> secrets = new HashSet<>();
        schema.get("x-secret-context").forEach(s -> secrets.add(s.asText()));
        if (!secrets.contains("module_url")) errors.add("le lien n'est plus déclaré secret");
        if (!String.valueOf(body.get("expires_at")).matches("\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\dZ")) {
            errors.add("expires_at n'est pas une date-time");
        }
        return errors;
    }
}
