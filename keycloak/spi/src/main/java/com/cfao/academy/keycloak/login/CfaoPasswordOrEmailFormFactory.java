package com.cfao.academy.keycloak.login;

import java.util.List;

import org.keycloak.Config;
import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.AuthenticatorFactory;
import org.keycloak.models.AuthenticationExecutionModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.models.credential.PasswordCredentialModel;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.provider.ProviderConfigurationBuilder;

/**
 * Authentificateur `cfao-password-or-email-form` (remplace auth-username-password-form).
 * Options : KC_SPI_AUTHENTICATOR__CFAO_PASSWORD_OR_EMAIL_FORM__SUPPORT_EMAIL et __CODE_PEPPER.
 * Sans hub configuré, il se comporte comme le formulaire mot de passe standard.
 */
public class CfaoPasswordOrEmailFormFactory implements AuthenticatorFactory {

    public static final String ID = "cfao-password-or-email-form";

    private MailLoginSettings settings;

    @Override
    public Authenticator create(KeycloakSession session) {
        return new CfaoPasswordOrEmailForm(session, settings);
    }

    @Override
    public void init(Config.Scope config) {
        settings = MailLoginSettings.of(config.get("support-email"), config.get("code-pepper"));
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
    public String getDisplayType() {
        return "CFAO : mot de passe ou code mail";
    }

    @Override
    public String getHelpText() {
        return "Connexion par mot de passe, ou par code à 6 chiffres et lien reçus par mail (hub cfao-academy-mail).";
    }

    @Override
    public String getReferenceCategory() {
        return PasswordCredentialModel.TYPE;
    }

    @Override
    public boolean isConfigurable() {
        return false;
    }

    @Override
    public AuthenticationExecutionModel.Requirement[] getRequirementChoices() {
        return new AuthenticationExecutionModel.Requirement[] {AuthenticationExecutionModel.Requirement.REQUIRED};
    }

    @Override
    public boolean isUserSetupAllowed() {
        return false;
    }

    @Override
    public List<ProviderConfigProperty> getConfigProperties() {
        return List.of();
    }

    @Override
    public List<ProviderConfigProperty> getConfigMetadata() {
        return ProviderConfigurationBuilder.create()
                .property().name("support-email").type("string")
                .helpText("Destinataire des alertes support (adresse inconnue ou compte désactivé)").add()
                .property().name("code-pepper").type("password")
                .helpText("Secret partagé par les nœuds pour l'empreinte des codes (32 caractères au moins)").add()
                .build();
    }
}
