package com.cfao.academy.keycloak.login;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.keycloak.models.SingleUseObjectProvider;

class MailLoginRulesTest {

    static final byte[] PEPPER = "0123456789abcdef0123456789abcdef".getBytes(StandardCharsets.UTF_8);

    @Test
    void rulesMatchTheDecision() {
        assertEquals(10, MailLoginRules.CODE_MINUTES);
        assertEquals(30, MailLoginRules.LINK_MINUTES);
        assertEquals(5, MailLoginRules.MAX_ATTEMPTS);
        assertEquals(3, MailLoginRules.REQUESTS_PER_WINDOW);
        assertEquals(900, MailLoginRules.WINDOW_SECONDS);
        assertEquals(20, MailLoginRules.ALERTS_PER_HOUR);
    }

    @ParameterizedTest
    @ValueSource(strings = {"kouame.assi@cfao.example", "a@b.co", "x+tag@filiale.cfao.example"})
    void acceptsAddresses(String email) {
        assertTrue(MailLoginRules.isValidEmail(email));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "kouame", "@cfao.example", "a@b", "a b@cfao.example", "a@@cfao.example", "a@.example"})
    void refusesNonAddresses(String email) {
        assertFalse(MailLoginRules.isValidEmail(email));
    }

    @Test
    void refusesOverlongAddressesAndNull() {
        assertFalse(MailLoginRules.isValidEmail(null));
        assertFalse(MailLoginRules.isValidEmail("a@" + "b".repeat(250) + ".example"));
        assertEquals("", MailLoginRules.normalizeEmail(null));
        assertEquals("a@b.co", MailLoginRules.normalizeEmail("  a@b.co "));
    }

    @Test
    void maskShowsOnlyTheFirstLetterAndTheDomain() {
        assertEquals("k***@cfao.example", MailLoginRules.mask("kouame.assi@CFAO.example"));
        assertEquals("***", MailLoginRules.mask("@cfao.example"));
        assertEquals("***", MailLoginRules.mask("sans-arobase"));
    }

    @Test
    void codeToleratesSpacesAndDashes() {
        assertEquals("123456", MailLoginRules.normalizeCode(" 123 456 "));
        assertEquals("123456", MailLoginRules.normalizeCode("123-456"));
        assertEquals("", MailLoginRules.normalizeCode(null));
        assertTrue(MailLoginRules.isCodeFormat("012345"));
        assertFalse(MailLoginRules.isCodeFormat("12345"));
        assertFalse(MailLoginRules.isCodeFormat("1234567"));
        assertFalse(MailLoginRules.isCodeFormat("12a456"));
        assertFalse(MailLoginRules.isCodeFormat(null));
    }

    @Test
    void newCodeAlwaysHasSixDigits() {
        SecureRandom random = new SecureRandom();
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 200; i++) {
            String code = MailLoginRules.newCode(random);
            assertTrue(MailLoginRules.isCodeFormat(code), code);
            seen.add(code);
        }
        assertTrue(seen.size() > 150, "codes trop répétitifs");
    }

    @Test
    void hashIsBoundToPepperRequestAndCode() {
        String h = MailLoginRules.codeHash(PEPPER, "rid-1", "123456");
        assertEquals(64, h.length());
        assertEquals(h, MailLoginRules.codeHash(PEPPER, "rid-1", "123456"));
        assertNotEquals(h, MailLoginRules.codeHash(PEPPER, "rid-2", "123456"));
        assertNotEquals(h, MailLoginRules.codeHash(PEPPER, "rid-1", "123457"));
        assertNotEquals(h, MailLoginRules.codeHash("autre-poivre-0123456789abcdef0123".getBytes(StandardCharsets.UTF_8),
                "rid-1", "123456"));
        assertFalse(h.contains("123456"));
        assertTrue(MailLoginRules.sameHash(h, MailLoginRules.codeHash(PEPPER, "rid-1", "123456")));
        assertFalse(MailLoginRules.sameHash(h, null));
        assertFalse(MailLoginRules.sameHash(null, h));
    }

    @Test
    void slotsLimitRequestsThenFreeUpWhenTheyExpire() {
        Map<String, Long> store = new HashMap<>();
        SingleUseObjectProvider fake = fake(store);
        for (int i = 0; i < 3; i++) {
            assertTrue(MailLoginRules.takeSlot(fake, "cfao-mail-rate:x", 3, 900));
        }
        assertFalse(MailLoginRules.takeSlot(fake, "cfao-mail-rate:x", 3, 900), "4e demande refusée");
        assertTrue(MailLoginRules.takeSlot(fake, "cfao-mail-rate:y", 3, 900), "autre adresse non touchée");
        store.remove("cfao-mail-rate:x:1");
        assertTrue(MailLoginRules.takeSlot(fake, "cfao-mail-rate:x", 3, 900), "place expirée libérée");
        assertEquals(900L, store.get("cfao-mail-rate:x:0"));
    }

    @Test
    void homeIsTheOriginOfTheRedirect() {
        assertEquals("https://academy.example/", MailLoginRules.home("https://academy.example/oauth2/callback?x=1"));
        assertEquals("http://localhost:8088/", MailLoginRules.home("http://localhost:8088/callback"));
        assertNull(MailLoginRules.home(null));
        assertNull(MailLoginRules.home("javascript:alert(1)"));
        assertNull(MailLoginRules.home("com.cfao.app:/callback"));
        assertNull(MailLoginRules.home("not a uri"));
    }

    @Test
    void settingsRefuseAShortPepperAndHideSecrets() {
        assertThrows(IllegalStateException.class, () -> MailLoginSettings.of("s@cfao.example", "court"));
        MailLoginSettings random = MailLoginSettings.of(" ", null);
        assertNull(random.supportEmail());
        assertEquals(MailLoginSettings.MIN_PEPPER_LENGTH, random.pepper().length);
        MailLoginSettings set = MailLoginSettings.of(" s@cfao.example ", "0123456789abcdef0123456789abcdef");
        assertEquals("s@cfao.example", set.supportEmail());
        assertFalse(set.toString().contains("0123456789"));
        assertFalse(set.toString().contains("s@cfao.example"));
    }

    /** Magasin à usage unique en mémoire : seul putIfAbsent sert aux limites. */
    static SingleUseObjectProvider fake(Map<String, Long> store) {
        return (SingleUseObjectProvider) Proxy.newProxyInstance(MailLoginRulesTest.class.getClassLoader(),
                new Class<?>[] {SingleUseObjectProvider.class}, (proxy, method, args) -> {
                    if (method.getName().equals("putIfAbsent")) {
                        return store.putIfAbsent((String) args[0], (Long) args[1]) == null;
                    }
                    throw new UnsupportedOperationException(method.getName());
                });
    }
}
