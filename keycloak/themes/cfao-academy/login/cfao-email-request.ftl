<#-- Connexion par mail, étape 1 : saisie de l'adresse (extension cfao-password-or-email-form). -->
<#import "template.ftl" as layout>
<#-- Erreur rendue sous le champ et reliée à lui (motif input-error du login.ftl d'origine). -->
<#assign cfaoErreur = message?has_content && message.type = "error">
<@layout.registrationLayout displayMessage=!cfaoErreur; section>
    <#if section = "header">
        ${msg("cfaoEmailRequestTitle")}
    <#elseif section = "form">
        <form id="cfao-email-request" class="${properties.kcFormClass!}" action="${url.loginAction}" method="post">
            <div class="${properties.kcFormGroupClass!}">
                <label for="cfao-email" class="${properties.kcLabelClass!}">${msg("cfaoEmailLabel")}</label>
                <input id="cfao-email" class="${properties.kcInputClass!}" name="email" type="email" value="${cfaoEmail!''}"
                       autocomplete="email" inputmode="email" autofocus required dir="ltr" aria-describedby="cfao-email-help<#if cfaoErreur> input-error</#if>"
                       <#if cfaoErreur>aria-invalid="true"</#if>/>
                <#if cfaoErreur>
                    <span id="input-error" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">${kcSanitize(message.summary)?no_esc}</span>
                </#if>
                <p id="cfao-email-help" class="cfao-help">${msg("cfaoEmailRequestHelp")}</p>
            </div>
            <div id="kc-form-buttons" class="${properties.kcFormGroupClass!}">
                <button class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}"
                        id="cfao-send" name="cfao_action" value="send" type="submit">${msg("cfaoSendCode")}</button>
            </div>
            <div class="cfao-secondary-actions">
                <button class="cfao-btn-secondary" name="cfao_action" value="have-code" type="submit" formnovalidate>${msg("cfaoHaveCode")}</button>
                <button class="cfao-btn-secondary" name="cfao_action" value="back" type="submit" formnovalidate>${msg("cfaoBackToPassword")}</button>
            </div>
        </form>
    </#if>
</@layout.registrationLayout>
