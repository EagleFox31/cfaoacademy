# Image unique du Keycloak commun (realm `cfao`), deux usages :
# - serveur : `start --optimized` (build Keycloak fait ici, Postgres + health) ;
# - application du realm : keycloak-config-cli, lancé une fois par déploiement
#   (`docker compose run --rm config`), sur les fichiers embarqués.
# Contexte de build : keycloak/. Seuls config/*.yaml sont copiés : les comptes
# de démo (config/dev/) ne peuvent pas entrer dans l'image.
FROM adorsys/keycloak-config-cli:6.5.1-26.5.5 AS config-cli

FROM quay.io/keycloak/keycloak:26.5.5 AS builder
ENV KC_DB=postgres KC_HEALTH_ENABLED=true
COPY themes /opt/keycloak/themes
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.5.5
ARG VERSION=dev
LABEL org.opencontainers.image.title="CFAO Keycloak" \
      org.opencontainers.image.description="Keycloak commun de la plateforme, realm cfao embarqué" \
      org.opencontainers.image.vendor="CFAO Mobility" \
      org.opencontainers.image.version="${VERSION}"
COPY --from=builder /opt/keycloak/ /opt/keycloak/
COPY --from=config-cli /app/keycloak-config-cli.jar /opt/cfao-config-cli/keycloak-config-cli.jar
COPY config/*.yaml /opt/cfao-realm/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized"]
