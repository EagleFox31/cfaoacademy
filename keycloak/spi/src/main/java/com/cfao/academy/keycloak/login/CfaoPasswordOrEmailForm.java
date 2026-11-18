package com.cfao.academy.keycloak.login;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import com.cfao.academy.keycloak.hub.HubClient;
import com.cfao.academy.keycloak.hub.HubEmailTemplateProviderFactory;
import com.cfao.academy.keycloak.hub.HubMail;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.authenticators.browser.UsernamePasswordForm;
import org.keycloak.common.util.Time;
import org.keycloak.email.EmailTemplateProvider;
import org.keycloak.forms.login.LoginFormsProvider;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.RoleModel;
import org.keycloak.models.SingleUseObjectProvider;
import org.keycloak.models.UserModel;
import org.keycloak.provider.ProviderFactory;
import org.keycloak.services.managers.BruteForceProtector;
import org.keycloak.sessions.AuthenticationSessionCompoundId;
import org.keycloak.sessions.AuthenticationSessionModel;

/**
 * Formulaire de connexion : mot de passe (inchangé) ou code reçu par mail.
 * Même page affichée quelle que soit l'adresse (connue, inconnue, exclue, limitée) :
 * la réponse ne révèle jamais l'existence d'un compte.
 * Exclus : super admins (rôle superadmin), comptes désactivés ou verrouillés.
 */
public class CfaoPasswordOrEmailForm extends UsernamePasswordForm {

    static final String ACTION = "cfao_action";
    static final String NOTE_EMAIL = "cfao.mail.email";
    static final String NOTE_REQUEST = "cfao.mail.request";
    static final String NOTE_ATTEMPTS = "cfao.mail.attempts";
    /** Page affichée (request / code) : un GET (changement de langue, F5) y revient. */
    static final String NOTE_STEP = "cfao.mail.step";
    static final String REQUEST_PAGE = "cfao-email-request.ftl";
    static final String CODE_PAGE = "cfao-email-code.ftl";
    static final String SUPERADMIN = "superadmin";

    private static final Logger LOG = Logger.getLogger(CfaoPasswordOrEmailForm.class);

    private final KeycloakSession session;
    private final MailLoginSettings settings;

    CfaoPasswordOrEmailForm(KeycloakSession session, MailLoginSettings settings) {
        super(session);
        this.session = session;
        this.settings = settings;
    }

    static HubClient hub(KeycloakSession session) {
        ProviderFactory<EmailTemplateProvider> factory = session.getKeycloakSessionFactory()
                .getProviderFactory(EmailTemplateProvider.class, HubEmailTemplateProviderFactory.ID);
        return factory instanceof HubEmailTemplateProviderFactory hubFactory ? hubFactory.hub() : null;
    }

    /** Un compte peut recevoir et utiliser un code : actif, non super admin, non verrouillé. */
    static boolean eligible(KeycloakSession session, RealmModel realm, UserModel user) {
        if (user == null || !user.isEnabled() || user.getEmail() == null) {
            return false;
        }
        RoleModel superadmin = realm.getRole(SUPERADMIN);
        if (superadmin != null && user.hasRole(superadmin)) {
            return false;
        }
        BruteForceProtector protector = session.getProvider(BruteForceProtector.class);
        return !realm.isBruteForceProtected() || protector == null
                || !(protector.isTemporarilyDisabled(session, realm, user)
                     || protector.isPermanentlyLockedOut(session, realm, user));
    }

    static void clearNotes(KeycloakSession session, AuthenticationSessionModel authSession) {
        String requestId = authSession.getAuthNote(NOTE_REQUEST);
        if (requestId != null) {
            session.singleUseObjects().remove(MailLoginRules.requestKey(requestId));
        }
        authSession.removeAuthNote(NOTE_REQUEST);
        authSession.removeAuthNote(NOTE_EMAIL);
        authSession.removeAuthNote(NOTE_ATTEMPTS);
        authSession.removeAuthNote(NOTE_STEP);
    }

    /**
     * Un GET sur l'étape (lien de langue kc_locale, rechargement) rappelle authenticate :
     * on réaffiche la page du parcours par mail en cours au lieu de la page mot de passe.
     */
    @Override
    public void authenticate(AuthenticationFlowContext context) {
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        String step = authSession.getAuthNote(NOTE_STEP);
        if (step == null || hub(session) == null) {
            super.authenticate(context);
            return;
        }
        String email = authSession.getAuthNote(NOTE_EMAIL);
        context.challenge("code".equals(step) && email != null
                ? codePage(context, null)
                : requestPage(context, email, null));
    }

    /** Première page (authenticate) : rendue sans passer par createLoginForm. */
    @Override
    protected Response challenge(AuthenticationFlowContext context, MultivaluedMap<String, String> formData) {
        // context.form() rend le même fournisseur pour toute la requête : l'attribut reste posé.
        context.form().setAttribute("cfaoMailLogin", hub(session) != null);
        return super.challenge(context, formData);
    }

    /** Pages d'erreur du mot de passe (challenge(context, error, field)). */
    @Override
    protected Response createLoginForm(LoginFormsProvider form) {
        form.setAttribute("cfaoMailLogin", hub(session) != null);
        return super.createLoginForm(form);
    }

    @Override
    public void action(AuthenticationFlowContext context) {
        MultivaluedMap<String, String> form = context.getHttpRequest().getDecodedFormParameters();
        String action = form.getFirst(ACTION);
        HubClient hub = hub(session);
        if (action == null || hub == null) {
            // Mot de passe soumis (retour arrière du navigateur) : on quitte le parcours par mail.
            context.getAuthenticationSession().removeAuthNote(NOTE_STEP);
            super.action(context);
            return;
        }
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        switch (action) {
            case "email" -> context.challenge(requestPage(context, authSession.getAuthNote(NOTE_EMAIL), null));
            case "send" -> send(context, hub, form.getFirst("email"));
            case "resend" -> send(context, hub, authSession.getAuthNote(NOTE_EMAIL));
            case "have-code" -> context.challenge(authSession.getAuthNote(NOTE_EMAIL) == null
                    ? requestPage(context, null, "cfaoNoPendingCode")
                    : codePage(context, null));
            case "code" -> checkCode(context, form.getFirst("code"));
            case "back" -> {
                clearNotes(session, authSession);
                context.challenge(challenge(context, new MultivaluedHashMap<>()));
            }
            default -> super.action(context);
        }
    }

    private Response requestPage(AuthenticationFlowContext context, String email, String error) {
        context.getAuthenticationSession().setAuthNote(NOTE_STEP, "request");
        LoginFormsProvider form = context.form().setAttribute("cfaoEmail", email == null ? "" : email);
        if (error != null) {
            form.setError(error);
        }
        return form.createForm(REQUEST_PAGE);
    }

    private Response codePage(AuthenticationFlowContext context, String error) {
        context.getAuthenticationSession().setAuthNote(NOTE_STEP, "code");
        String email = context.getAuthenticationSession().getAuthNote(NOTE_EMAIL);
        LoginFormsProvider form = context.form().setAttribute("cfaoMaskedEmail", MailLoginRules.mask(email));
        if (error != null) {
            form.setError(error);
        }
        return form.createForm(CODE_PAGE);
    }

    private void send(AuthenticationFlowContext context, HubClient hub, String raw) {
        String email = MailLoginRules.normalizeEmail(raw);
        if (!MailLoginRules.isValidEmail(email)) {
            context.challenge(requestPage(context, email, "cfaoEmailInvalid"));
            return;
        }
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        clearNotes(session, authSession);
        authSession.setAuthNote(NOTE_EMAIL, email);
        RealmModel realm = context.getRealm();
        SingleUseObjectProvider store = session.singleUseObjects();
        String hash = HubMail.addressHash(email);
        if (MailLoginRules.takeSlot(store, "cfao-mail-rate:" + hash, MailLoginRules.REQUESTS_PER_WINDOW,
                MailLoginRules.WINDOW_SECONDS)) {
            UserModel user = session.users().getUserByEmail(realm, email);
            if (user == null) {
                alert(hub, store, email, hash, "Aucun compte actif pour cette adresse");
            } else if (!user.isEnabled()) {
                alert(hub, store, email, hash, "Compte désactivé");
            } else if (eligible(session, realm, user)) {
                issue(context, hub, store, user);
            }
            // Super admin ou compte verrouillé : rien n'est envoyé, la page reste la même.
        } else {
            LOG.debugf("cfao-mail : limite de demandes atteinte pour %s", hash.substring(0, 12));
        }
        context.challenge(codePage(context, null));
    }

    private void issue(AuthenticationFlowContext context, HubClient hub, SingleUseObjectProvider store,
                       UserModel user) {
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        String requestId = UUID.randomUUID().toString();
        String code = MailLoginRules.newCode(settings.random());
        int now = Time.currentTime();
        Map<String, String> request = new HashMap<>();
        request.put("userId", user.getId());
        request.put("codeHash", MailLoginRules.codeHash(settings.pepper(), requestId, code));
        request.put("codeExp", String.valueOf(now + MailLoginRules.CODE_MINUTES * 60));
        store.put(MailLoginRules.requestKey(requestId), MailLoginRules.LINK_MINUTES * 60L, request);
        authSession.setAuthNote(NOTE_REQUEST, requestId);

        CfaoLoginLinkToken token = new CfaoLoginLinkToken(user.getId(), now + MailLoginRules.LINK_MINUTES * 60,
                UUID.fromString(requestId), authSession.getClient().getClientId(),
                MailLoginRules.home(authSession.getRedirectUri()),
                AuthenticationSessionCompoundId.fromAuthSession(authSession).getEncodedId());
        String link = context.getActionTokenUrl(token.serialize(session, context.getRealm(), context.getUriInfo()))
                .toString();
        hub.enqueue(HubMail.loginCode(user.getEmail(), session.getContext().resolveLocale(user),
                user.getFirstName(), user.getLastName(), user.getUsername(), user.getId(),
                code, MailLoginRules.CODE_MINUTES, link, MailLoginRules.LINK_MINUTES, Instant.now()));
    }

    /** Une alerte par adresse et par jour, 20 par heure au plus pour tout le realm. */
    private void alert(HubClient hub, SingleUseObjectProvider store, String email, String hash, String problem) {
        if (settings.supportEmail() == null) {
            return;
        }
        String addressKey = "cfao-mail-alert-addr:" + hash + ":" + LocalDate.now(ZoneOffset.UTC);
        if (store.contains(addressKey)) {
            return;
        }
        long hour = Time.currentTime() / 3600L;
        if (!MailLoginRules.takeSlot(store, "cfao-mail-alert:" + hour, MailLoginRules.ALERTS_PER_HOUR, 3600)) {
            LOG.warn("cfao-mail : plafond horaire des alertes support atteint");
            return;
        }
        if (store.putIfAbsent(addressKey, 86400)) {
            hub.enqueue(HubMail.supportAlert(settings.supportEmail(), email, "Connexion par mail", problem,
                    Instant.now()));
        }
    }

    private void checkCode(AuthenticationFlowContext context, String raw) {
        AuthenticationSessionModel authSession = context.getAuthenticationSession();
        if (authSession.getAuthNote(NOTE_EMAIL) == null) {
            context.challenge(requestPage(context, null, "cfaoNoPendingCode"));
            return;
        }
        int attempts = parseInt(authSession.getAuthNote(NOTE_ATTEMPTS)) + 1;
        authSession.setAuthNote(NOTE_ATTEMPTS, String.valueOf(attempts));
        String requestId = authSession.getAuthNote(NOTE_REQUEST);
        if (attempts > MailLoginRules.MAX_ATTEMPTS) {
            if (requestId != null) {
                session.singleUseObjects().remove(MailLoginRules.requestKey(requestId));
                authSession.removeAuthNote(NOTE_REQUEST);
            }
            context.challenge(codePage(context, "cfaoCodeTooManyAttempts"));
            return;
        }
        RealmModel realm = context.getRealm();
        SingleUseObjectProvider store = session.singleUseObjects();
        String code = MailLoginRules.normalizeCode(raw);
        Map<String, String> request = requestId == null ? null : store.get(MailLoginRules.requestKey(requestId));
        UserModel user = request == null ? null : session.users().getUserById(realm, request.get("userId"));
        boolean valid = user != null && MailLoginRules.isCodeFormat(code)
                && Time.currentTime() <= parseInt(request.get("codeExp"))
                && MailLoginRules.sameHash(request.get("codeHash"),
                        MailLoginRules.codeHash(settings.pepper(), requestId, code));
        if (!valid) {
            if (user != null && MailLoginRules.isCodeFormat(code)) {
                BruteForceProtector protector = session.getProvider(BruteForceProtector.class);
                if (realm.isBruteForceProtected() && protector != null) {
                    protector.failedLogin(realm, user, context.getConnection(), context.getUriInfo());
                }
            }
            context.challenge(codePage(context, "cfaoCodeInvalid"));
            return;
        }
        // Le lien a pu être utilisé entre-temps : seul le premier des deux l'emporte.
        if (store.remove(MailLoginRules.requestKey(requestId)) == null || !eligible(session, realm, user)) {
            authSession.removeAuthNote(NOTE_REQUEST);
            context.challenge(codePage(context, "cfaoCodeInvalid"));
            return;
        }
        clearNotes(session, authSession);
        context.getEvent().detail("auth_method", "cfao-mail-code");
        context.setUser(user);
        context.success();
    }

    private static int parseInt(String value) {
        try {
            return value == null ? 0 : Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
