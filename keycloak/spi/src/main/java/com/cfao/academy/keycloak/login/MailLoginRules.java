package com.cfao.academy.keycloak.login;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Locale;
import java.util.regex.Pattern;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.keycloak.models.SingleUseObjectProvider;

/** Règles de la connexion par mail, sans état ni dépendance au flux : testables seules. */
public final class MailLoginRules {

    static final int CODE_MINUTES = 10;
    static final int LINK_MINUTES = 30;
    static final int MAX_ATTEMPTS = 5;
    static final int REQUESTS_PER_WINDOW = 3;
    static final int WINDOW_SECONDS = 15 * 60;
    static final int ALERTS_PER_HOUR = 20;

    // Domaine avec un point : le hub refuse sinon l'adresse en reply_to de l'alerte.
    private static final Pattern EMAIL = Pattern.compile("[^\\s@]{1,64}@[^\\s@.]+(\\.[^\\s@.]+)+");
    private static final Pattern CODE = Pattern.compile("[0-9]{6}");

    private MailLoginRules() {
    }

    static String normalizeEmail(String raw) {
        return raw == null ? "" : raw.trim();
    }

    static boolean isValidEmail(String email) {
        return email != null && email.length() <= 254 && EMAIL.matcher(email).matches();
    }

    /** k***@cfao.example : l'utilisateur reconnaît son adresse, un tiers n'apprend rien. */
    static String mask(String email) {
        int at = email.indexOf('@');
        if (at < 1) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(at).toLowerCase(Locale.ROOT);
    }

    /** Espaces et tirets tolérés (code recopié « 123 456 » ou « 123-456 »). */
    static String normalizeCode(String raw) {
        return raw == null ? "" : raw.replaceAll("[\\s-]", "");
    }

    static boolean isCodeFormat(String code) {
        return code != null && CODE.matcher(code).matches();
    }

    static String newCode(SecureRandom random) {
        return String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000));
    }

    /** HMAC-SHA256(poivre, demande:code) : la base ne garde jamais un code exploitable. */
    static String codeHash(byte[] pepper, String requestId, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(pepper, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((requestId + ":" + code).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Comparaison en temps constant. */
    static boolean sameHash(String expected, String actual) {
        if (expected == null || actual == null) {
            return false;
        }
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),
                actual.getBytes(StandardCharsets.US_ASCII));
    }

    /**
     * Prend l'une des `slots` places de la fenêtre ; faux si toutes sont prises.
     * Chaque place expire seule : fenêtre glissante, partagée par les nœuds du cluster.
     */
    static boolean takeSlot(SingleUseObjectProvider store, String prefix, int slots, long lifespanSeconds) {
        for (int i = 0; i < slots; i++) {
            if (store.putIfAbsent(prefix + ":" + i, lifespanSeconds)) {
                return true;
            }
        }
        return false;
    }

    static String requestKey(String requestId) {
        return "cfao-mail-login:" + requestId;
    }

    /**
     * Origine de la redirection validée par Keycloak à l'ouverture de la connexion
     * (https://hote/oauth2/callback → https://hote/) : là où renvoyer un lien ouvert ailleurs.
     */
    static String home(String redirectUri) {
        if (redirectUri == null) {
            return null;
        }
        try {
            URI uri = URI.create(redirectUri);
            String scheme = uri.getScheme();
            if (uri.getHost() == null || !("https".equals(scheme) || "http".equals(scheme))) {
                return null;
            }
            return scheme + "://" + uri.getHost() + (uri.getPort() == -1 ? "" : ":" + uri.getPort()) + "/";
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
