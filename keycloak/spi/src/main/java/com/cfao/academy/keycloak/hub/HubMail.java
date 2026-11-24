package com.cfao.academy.keycloak.hub;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Corps d'un appel au hub (contrat mail-outbound ^0.2), sans dépendance au runtime Keycloak.
 * Le lien et le code sont des secrets : ils n'apparaissent jamais dans toString() ni dans les journaux.
 */
public final class HubMail {

    public static final String SOURCE = "cfao-identity";
    public static final String PASSWORD_RESET = "identity.password_reset";
    public static final String EXECUTE_ACTIONS = "identity.execute_actions";
    public static final String VERIFY_EMAIL = "identity.verify_email";
    public static final String LOGIN_CODE = "identity.login_code";
    public static final String LOGIN_SUPPORT_ALERT = "identity.login_support_alert";

    static final Set<String> LANGUAGES = Set.of("fr", "en", "pt");
    // Plafond du hub (MAIL_SENSITIVE_MAX_TTL_MINUTES) et du champ link_minutes (4 chiffres).
    static final long MAX_DELIVERY_MINUTES = 1440;
    static final long MAX_LINK_MINUTES = 9999;

    private final String kind;
    private final String to;
    private final String locale;
    private final Map<String, Object> context;
    private final String link;
    private final Instant expiresAt;
    private final String sourceRef;
    private final String correlationId;
    private final String replyTo;

    private HubMail(String kind, String to, String locale, Map<String, Object> context, String link,
                    Instant expiresAt, String sourceRef, String correlationId, String replyTo) {
        this.kind = kind;
        this.to = to;
        this.locale = locale;
        this.context = context;
        this.link = link;
        this.expiresAt = expiresAt;
        this.sourceRef = sourceRef;
        this.correlationId = correlationId;
        this.replyTo = replyTo;
    }

    /** Mail d'action (mot de passe, actions admin, vérification) : un lien à usage unique. */
    public static HubMail link(String kind, String to, Locale locale, String firstName, String lastName,
                               String username, String userId, String link, long minutes, Instant now) {
        long linkMinutes = clampMinutes(minutes);
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("display_name", displayName(firstName, lastName, username));
        context.put("link_minutes", String.valueOf(linkMinutes));
        return new HubMail(kind, to, language(locale), context, link, deadline(now, linkMinutes),
                "user:" + userId, null, null);
    }

    /** Connexion par mail : code à 6 chiffres et bouton (lien à usage unique), l'un consomme l'autre. */
    public static HubMail loginCode(String to, Locale locale, String firstName, String lastName, String username,
                                    String userId, String code, long codeMinutes, String link, long linkMinutes,
                                    Instant now) {
        long codeM = clampMinutes(codeMinutes);
        long linkM = clampMinutes(linkMinutes);
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("display_name", displayName(firstName, lastName, username));
        context.put("code", code);
        context.put("code_minutes", String.valueOf(codeM));
        context.put("link_minutes", String.valueOf(linkM));
        // Remis tant que l'un des deux sert encore.
        return new HubMail(LOGIN_CODE, to, language(locale), context, link, deadline(now, Math.max(codeM, linkM)),
                "user:" + userId, null, null);
    }

    /**
     * Alerte support : demande de connexion sans suite. Une par adresse et par jour (UTC) :
     * le hub dédoublonne sur le correlation_id. Répondre au mail écrit à l'adresse saisie.
     */
    public static HubMail supportAlert(String supportTo, String entered, String request, String problem,
                                       Instant now) {
        String enteredEmail = entered.trim();
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("display_name", "Support");
        context.put("entered_email", enteredEmail);
        context.put("request", request);
        context.put("problem", problem);
        String day = LocalDate.ofInstant(now, java.time.ZoneOffset.UTC).toString();
        return new HubMail(LOGIN_SUPPORT_ALERT, supportTo, "fr", context, null, null, "login-support",
                LOGIN_SUPPORT_ALERT + ":" + addressHash(enteredEmail) + ":" + day, enteredEmail);
    }

    /** Empreinte d'une adresse (minuscules, espaces retirés) : clé de limite et de dédoublonnage. */
    public static String addressHash(String email) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(email.trim().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static long clampMinutes(long minutes) {
        return Math.max(1, Math.min(minutes, MAX_LINK_MINUTES));
    }

    // L'échéance d'envoi suit le lien, dans la limite acceptée par le hub.
    private static Instant deadline(Instant now, long minutes) {
        return now.plus(Duration.ofMinutes(Math.min(minutes, MAX_DELIVERY_MINUTES))).truncatedTo(ChronoUnit.SECONDS);
    }

    static String language(Locale locale) {
        String code = locale == null ? "" : locale.getLanguage().toLowerCase(Locale.ROOT);
        return LANGUAGES.contains(code) ? code : "fr";
    }

    static String displayName(String firstName, String lastName, String username) {
        String name = (blankToEmpty(firstName) + " " + blankToEmpty(lastName)).trim();
        return name.isEmpty() ? blankToEmpty(username) : name;
    }

    private static String blankToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    public Map<String, Object> payload() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("kind", kind);
        body.put("source_app", SOURCE);
        body.put("source_ref", sourceRef);
        body.put("to", List.of(to));
        body.put("locale", locale);
        if (expiresAt != null) {
            body.put("expires_at", expiresAt.toString());
        }
        if (link != null) {
            body.put("module_url", link);
        }
        if (correlationId != null) {
            body.put("correlation_id", correlationId);
        }
        if (replyTo != null) {
            body.put("reply_to", replyTo);
        }
        body.put("context", new LinkedHashMap<>(context));
        return body;
    }

    public String kind() {
        return kind;
    }

    @Override
    public String toString() {
        return "HubMail[" + kind + ", " + sourceRef + "]";
    }
}
