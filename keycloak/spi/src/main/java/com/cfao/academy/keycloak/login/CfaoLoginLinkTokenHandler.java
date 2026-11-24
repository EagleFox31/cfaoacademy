package com.cfao.academy.keycloak.login;

import java.util.Map;

import jakarta.ws.rs.core.Response;
import org.keycloak.TokenVerifier;
import org.keycloak.authentication.actiontoken.AbstractActionTokenHandler;
import org.keycloak.authentication.actiontoken.ActionTokenContext;
import org.keycloak.authentication.actiontoken.DefaultActionToken;
import org.keycloak.authentication.actiontoken.TokenUtils;
import org.keycloak.events.Errors;
import org.keycloak.events.EventType;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.protocol.oidc.OIDCLoginProtocol;
import org.keycloak.protocol.oidc.utils.OIDCResponseType;
import org.keycloak.services.ErrorPage;
import org.keycloak.services.managers.AuthenticationManager;
import org.keycloak.sessions.AuthenticationSessionModel;

/**
 * Clic sur le bouton du mail : consomme la demande (le code devient inutilisable), ouvre la session.
 * Même navigateur : la connexion en cours se termine vers l'application qui l'a demandée.
 * Autre navigateur : session SSO ouverte, puis retour à l'accueil de cette application.
 */
public class CfaoLoginLinkTokenHandler extends AbstractActionTokenHandler<CfaoLoginLinkToken> {

    static final String INVALID = "cfaoMailLinkInvalid";

    public CfaoLoginLinkTokenHandler() {
        super(CfaoLoginLinkToken.TOKEN_TYPE, CfaoLoginLinkToken.class, INVALID, EventType.LOGIN, Errors.INVALID_TOKEN);
    }

    @Override
    public TokenVerifier.Predicate<? super CfaoLoginLinkToken>[] getVerifiers(
            ActionTokenContext<CfaoLoginLinkToken> tokenContext) {
        return TokenUtils.predicates(DefaultActionToken.ACTION_TOKEN_BASIC_CHECKS);
    }

    @Override
    public boolean canUseTokenRepeatedly(CfaoLoginLinkToken token, ActionTokenContext<CfaoLoginLinkToken> ctx) {
        return false;
    }

    @Override
    public AuthenticationSessionModel startFreshAuthenticationSession(CfaoLoginLinkToken token,
                                                                      ActionTokenContext<CfaoLoginLinkToken> ctx) {
        // Contrairement au défaut (END_AFTER_REQUIRED_ACTIONS), une vraie session est ouverte.
        AuthenticationSessionModel authSession = ctx.createAuthenticationSessionForClient(token.getIssuedFor());
        String home = token.getHome();
        if (home != null) {
            // Retour à l'accueil sans code d'autorisation dans l'URL : l'application relance
            // sa connexion et la trouve déjà ouverte.
            authSession.setRedirectUri(home);
            authSession.setClientNote(OIDCLoginProtocol.REDIRECT_URI_PARAM, home);
            authSession.setClientNote(OIDCLoginProtocol.RESPONSE_TYPE_PARAM, OIDCResponseType.NONE);
        }
        return authSession;
    }

    @Override
    public Response handleToken(CfaoLoginLinkToken token, ActionTokenContext<CfaoLoginLinkToken> ctx) {
        KeycloakSession session = ctx.getSession();
        RealmModel realm = ctx.getRealm();
        AuthenticationSessionModel authSession = ctx.getAuthenticationSession();
        String requestId = token.getActionVerificationNonce().toString();
        // Une seule consommation possible, code ou lien, sur tous les nœuds.
        Map<String, String> request = session.singleUseObjects().remove(MailLoginRules.requestKey(requestId));
        UserModel user = session.users().getUserById(realm, token.getUserId());
        if (request == null || user == null || !token.getUserId().equals(request.get("userId"))
                || !CfaoPasswordOrEmailForm.eligible(session, realm, user)) {
            ctx.getEvent().error(Errors.INVALID_TOKEN);
            return ErrorPage.error(session, authSession, Response.Status.BAD_REQUEST, INVALID);
        }
        CfaoPasswordOrEmailForm.clearNotes(session, authSession);
        authSession.setAuthenticatedUser(user);
        ctx.getEvent().user(user).detail("auth_method", "cfao-mail-link");
        String next = AuthenticationManager.nextRequiredAction(session, authSession, ctx.getRequest(), ctx.getEvent());
        return AuthenticationManager.redirectToRequiredActions(session, realm, authSession, ctx.getUriInfo(), next);
    }
}
