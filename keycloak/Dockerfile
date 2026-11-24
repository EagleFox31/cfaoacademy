# Image unique du Keycloak commun (realm `cfao`), deux usages :
# - serveur : `start --optimized` (build Keycloak fait ici, Postgres + health) ;
# - application du realm : keycloak-config-cli, lancé une fois par déploiement
#   (`docker compose run --rm config`), sur les fichiers embarqués.
# Contexte de build : keycloak/. Seuls config/*.yaml sont copiés : les comptes
# de démo (config/dev/) ne peuvent pas entrer dans l'image.
FROM adorsys/keycloak-config-cli:6.5.1-26.5.5 AS config-cli

# Extension cfao-hub : les mails d'action de Keycloak partent par le hub cfao-academy-mail.
# Les tests JUnit (dont le contrat mail-outbound) tournent en CI, dépôt complet monté.
FROM maven:3.9.9-eclipse-temurin-21 AS spi
WORKDIR /spi
COPY spi/pom.xml .
RUN mvn -B -q dependency:go-offline
COPY spi/src/main src/main
RUN mvn -B -q -Dmaven.test.skip=true package

FROM quay.io/keycloak/keycloak:26.5.5 AS builder
# Servi sous /auth, comme son URL publique : Keycloak calcule ses URL depuis le
# chemin reçu, la passerelle commune ne retire donc jamais le préfixe.
# Gestion (9000) laissée à la racine : /health/ready inchangé.
# Sans KC_SPI_EMAIL_TEMPLATE__CFAO_HUB__URL ni __SERVICE_KEY, cfao-hub garde les mails de Keycloak.
ENV KC_DB=postgres KC_HEALTH_ENABLED=true \
    KC_HTTP_RELATIVE_PATH=/auth KC_HTTP_MANAGEMENT_RELATIVE_PATH=/ \
    KC_SPI_EMAIL_TEMPLATE__PROVIDER=cfao-hub
COPY themes /opt/keycloak/themes
COPY --from=spi /spi/target/cfao-keycloak-hub.jar /opt/keycloak/providers/
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.5.5
# contracts:begin - bloc géré par contracts/sync.py, ne pas éditer
LABEL org.cfao.contracts.consumes="mail-outbound@^0.2" \
      org.cfao.module="keycloak"
# contracts:end
ARG VERSION=dev
LABEL org.opencontainers.image.title="CFAO Keycloak" \
      org.opencontainers.image.description="Keycloak commun de la plateforme, realm cfao embarqué" \
      org.opencontainers.image.vendor="CFAO Mobility" \
      org.opencontainers.image.version="${VERSION}"
COPY --from=builder /opt/keycloak/ /opt/keycloak/
ENV KC_HTTP_RELATIVE_PATH=/auth KC_HTTP_MANAGEMENT_RELATIVE_PATH=/ \
    KC_SPI_EMAIL_TEMPLATE__PROVIDER=cfao-hub
COPY --from=config-cli /app/keycloak-config-cli.jar /opt/cfao-config-cli/keycloak-config-cli.jar
COPY config/*.yaml /opt/cfao-realm/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized"]
