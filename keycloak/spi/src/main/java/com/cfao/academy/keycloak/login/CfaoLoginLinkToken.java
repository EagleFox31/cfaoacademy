package com.cfao.academy.keycloak.login;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.keycloak.authentication.actiontoken.DefaultActionToken;

/** Bouton du mail de connexion : usage unique, lié à la demande (nonce = identifiant de la demande). */
public class CfaoLoginLinkToken extends DefaultActionToken {

    public static final String TOKEN_TYPE = "cfao-login-link";

    // Où envoyer l'utilisateur si le lien est ouvert dans un autre navigateur.
    @JsonProperty("cfao_home")
    private String home;

    public CfaoLoginLinkToken(String userId, int absoluteExpirationInSecs, UUID requestId, String clientId,
                              String home, String compoundAuthenticationSessionId) {
        super(userId, TOKEN_TYPE, absoluteExpirationInSecs, requestId);
        issuedFor(clientId);
        this.home = home;
        setCompoundAuthenticationSessionId(compoundAuthenticationSessionId);
    }

    private CfaoLoginLinkToken() {
        // Désérialisation.
    }

    public String getHome() {
        return home;
    }
}
