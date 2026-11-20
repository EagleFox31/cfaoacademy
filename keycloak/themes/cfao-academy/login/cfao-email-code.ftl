<#-- Connexion par mail, étape 2 : saisie du code. Même page que l'adresse existe ou non. -->
<#import "template.ftl" as layout>
<#-- Erreur rendue sous le champ et reliée à lui (motif input-error du login.ftl d'origine). -->
<#assign cfaoErreur = message?has_content && message.type = "error">
<@layout.registrationLayout displayMessage=!cfaoErreur; section>
    <#if section = "header">
        ${msg("cfaoCodeTitle")}
    <#elseif section = "form">
        <p id="cfao-code-sent" class="cfao-help" aria-live="polite">${msg("cfaoCodeSent", cfaoMaskedEmail!'')}</p>
        <form id="cfao-email-code" class="${properties.kcFormClass!}" action="${url.loginAction}" method="post">
            <div class="${properties.kcFormGroupClass!}">
                <label for="cfao-code" class="${properties.kcLabelClass!}">${msg("cfaoCodeLabel")}</label>
                <input id="cfao-code" class="${properties.kcInputClass!}" name="code" type="text"
                       inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 \-]*" maxlength="9"
                       autofocus required dir="ltr" aria-describedby="cfao-code-sent<#if cfaoErreur> input-error</#if>"
                       <#if cfaoErreur>aria-invalid="true"</#if>/>
                <#if cfaoErreur>
                    <span id="input-error" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">${kcSanitize(message.summary)?no_esc}</span>
                </#if>
            </div>
            <div id="kc-form-buttons" class="${properties.kcFormGroupClass!}">
                <button class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!} ${properties.kcButtonLargeClass!}"
                        id="cfao-code-submit" name="cfao_action" value="code" type="submit">${msg("cfaoCodeSubmit")}</button>
            </div>
            <div class="cfao-secondary-actions">
                <button class="cfao-btn-secondary" name="cfao_action" value="resend" type="submit" formnovalidate>${msg("cfaoResend")}</button>
                <button class="cfao-btn-secondary" name="cfao_action" value="email" type="submit" formnovalidate>${msg("cfaoChangeEmail")}</button>
                <button class="cfao-btn-secondary" name="cfao_action" value="back" type="submit" formnovalidate>${msg("cfaoBackToPassword")}</button>
            </div>
        </form>
    </#if>
</@layout.registrationLayout>
