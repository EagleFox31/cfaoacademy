"""Extension cfao-hub : alignée sur l'image Keycloak et réellement chargée par elle."""
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
KEYCLOAK = RACINE / "keycloak"
FACTORY = "com.cfao.academy.keycloak.hub.HubEmailTemplateProviderFactory"


def _texte(chemin):
    return chemin.read_text(encoding="utf-8")


def _etages():
    return _texte(KEYCLOAK / "Dockerfile").split("\nFROM ")


def test_version_keycloak_du_pom_egale_celle_de_l_image():
    pom = re.search(r"<keycloak.version>([\d.]+)</keycloak.version>", _texte(KEYCLOAK / "spi" / "pom.xml")).group(1)
    images = re.findall(r"quay.io/keycloak/keycloak:([\d.]+)", _texte(KEYCLOAK / "Dockerfile"))
    assert images and set(images) == {pom}


def test_le_jar_entre_avant_le_build_optimise():
    builder = next(e for e in _etages() if " AS builder\n" in e)
    copie = builder.index("COPY --from=spi /spi/target/cfao-keycloak-hub.jar /opt/keycloak/providers/")
    assert copie < builder.index("kc.sh build")
    # Fournisseur choisi au build et à l'exécution ; sans URL ni clé il garde les mails de Keycloak.
    assert "KC_SPI_EMAIL_TEMPLATE__PROVIDER=cfao-hub" in builder
    assert "KC_SPI_EMAIL_TEMPLATE__PROVIDER=cfao-hub" in _etages()[-1]


def test_seul_le_code_de_production_entre_dans_l_image():
    ignore = _texte(KEYCLOAK / ".dockerignore").split()
    assert "!spi/src/main/" in ignore and "!spi/pom.xml" in ignore
    assert not any("spi/src/test" in ligne or ligne == "!spi/" for ligne in ignore)


def test_le_fournisseur_est_declare_au_service_loader():
    services = KEYCLOAK / "spi/src/main/resources/META-INF/services/org.keycloak.email.EmailTemplateProviderFactory"
    assert _texte(services).split() == [FACTORY]
    source = KEYCLOAK / "spi/src/main/java" / (FACTORY.replace(".", "/") + ".java")
    assert 'ID = "cfao-hub"' in _texte(source)


def test_recette_joint_le_hub_par_le_maillage():
    import yaml

    recette = yaml.safe_load(_texte(RACINE / "edge" / "compose.dev.yml"))["services"]["keycloak"]
    env = recette["environment"]
    assert env["KC_SPI_EMAIL_TEMPLATE__CFAO_HUB__URL"] == "http://mail-api:5180"
    assert env["KC_SPI_EMAIL_TEMPLATE__CFAO_HUB__SERVICE_KEY"].startswith("${CFAO_IDENTITY_MAIL_KEY")
    assert "cfao-maillage" in recette["networks"]
    hub = yaml.safe_load(_texte(RACINE / "cfao-academy-mail" / "docker-compose.yml"))["services"]["mail-api"]
    assert "cfao-maillage" in hub["networks"]


# ── Connexion par code mail ──────────────────────────────────────────────────
LOGIN = "com.cfao.academy.keycloak.login"
THEME = KEYCLOAK / "themes" / "cfao-academy" / "login"
SERVICES = KEYCLOAK / "spi/src/main/resources/META-INF/services"
CLES = ["cfaoOr", "cfaoLoginByEmail", "cfaoEmailRequestTitle", "cfaoEmailRequestHelp", "cfaoEmailLabel",
        "cfaoSendCode", "cfaoHaveCode", "cfaoBackToPassword", "cfaoCodeTitle", "cfaoCodeSent", "cfaoCodeLabel",
        "cfaoCodeSubmit", "cfaoResend", "cfaoChangeEmail", "cfaoEmailInvalid", "cfaoNoPendingCode",
        "cfaoCodeInvalid", "cfaoCodeTooManyAttempts", "cfaoMailLinkInvalid"]


def test_formulaire_et_lien_declares_au_service_loader():
    assert _texte(SERVICES / "org.keycloak.authentication.AuthenticatorFactory").split() \
        == [f"{LOGIN}.CfaoPasswordOrEmailFormFactory"]
    assert _texte(SERVICES / "org.keycloak.authentication.actiontoken.ActionTokenHandlerFactory").split() \
        == [f"{LOGIN}.CfaoLoginLinkTokenHandler"]
    source = _texte(KEYCLOAK / "spi/src/main/java" / LOGIN.replace(".", "/") / "CfaoPasswordOrEmailFormFactory.java")
    # Même identifiant que l'étape du flux cfao-browser du realm.
    assert 'ID = "cfao-password-or-email-form"' in source
    assert "cfao-password-or-email-form" in _texte(KEYCLOAK / "config" / "cfao-realm.yaml")


def test_login_ftl_est_l_original_plus_le_seul_bloc_cfao():
    version = re.search(r"<keycloak.version>([\d.]+)</keycloak.version>", _texte(KEYCLOAK / "spi" / "pom.xml")).group(1)
    origine = _texte(THEME / "upstream" / f"login.ftl.{version}")
    surcharge = _texte(THEME / "login.ftl")
    bloc = re.search(r"\n[ \t]*<#-- cfao:begin mail-login.*?<#-- cfao:end mail-login -->", surcharge, re.S)
    assert bloc, "bloc cfao absent de login.ftl"
    # Toute montée de version de Keycloak oblige à recopier l'original et à y reporter le bloc.
    assert surcharge.replace(bloc.group(0), "", 1) == origine
    assert "cfaoMailLogin" in bloc.group(0) and 'value="email"' in bloc.group(0)


def test_pages_de_connexion_par_mail_presentes():
    demande = _texte(THEME / "cfao-email-request.ftl")
    code = _texte(THEME / "cfao-email-code.ftl")
    for action in ("send", "have-code", "back"):
        assert f'value="{action}"' in demande
    for action in ("code", "resend", "email", "back"):
        assert f'value="{action}"' in code
    assert 'autocomplete="one-time-code"' in code and 'inputmode="numeric"' in code
    # La page code ne révèle jamais si l'adresse existe : seule l'adresse masquée y figure.
    assert "cfaoMaskedEmail" in code and "cfaoEmail!" not in code
    for page, champ in ((demande, "cfao-email"), (code, "cfao-code")):
        # Chaque champ a son libellé ; l'erreur est sous le champ, reliée et annoncée, pas en double.
        assert f'<label for="{champ}"' in page and f'id="{champ}"' in page
        assert 'displayMessage=!cfaoErreur' in page
        assert 'aria-invalid="true"' in page and '<#if cfaoErreur> input-error</#if>' in page
        assert re.search(r'<span id="input-error"[^>]*aria-live="polite"', page)


def test_aucune_animation_decorative_dans_le_theme():
    css = re.sub(r"/\*.*?\*/", "", _texte(THEME / "resources" / "css" / "cfao.css"), flags=re.S)
    assert "@keyframes" not in css
    # Seule exception : la règle prefers-reduced-motion qui coupe celles de PatternFly.
    assert re.findall(r"animation[a-z-]*\s*:", css) == ["animation-duration:"]


def test_messages_de_connexion_par_mail_dans_les_trois_langues():
    for langue in ("fr", "en", "pt"):
        texte = _texte(THEME / "messages" / f"messages_{langue}.properties")
        cles = {ligne.split("=", 1)[0].strip() for ligne in texte.splitlines() if "=" in ligne and not ligne.startswith("#")}
        manquantes = [c for c in CLES if c not in cles]
        assert not manquantes, f"{langue} : {manquantes}"
        assert "{0}" in re.search(r"^cfaoCodeSent=(.*)$", texte, re.M).group(1)


def test_poivre_et_support_hors_du_depot():
    import yaml

    env = yaml.safe_load(_texte(RACINE / "edge" / "compose.dev.yml"))["services"]["keycloak"]["environment"]
    prefixe = "KC_SPI_AUTHENTICATOR__CFAO_PASSWORD_OR_EMAIL_FORM__"
    # Recette : rien d'écrit dans le dépôt, tout vient du .env local.
    assert env[prefixe + "SUPPORT_EMAIL"] == "${CFAO_LOGIN_SUPPORT_EMAIL:-}"
    assert env[prefixe + "CODE_PEPPER"] == "${CFAO_LOGIN_CODE_PEPPER:-}"
