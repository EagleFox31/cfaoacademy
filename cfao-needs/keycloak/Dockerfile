FROM quay.io/keycloak/keycloak:25.0

LABEL org.opencontainers.image.title="CFAO Needs Keycloak" \
      org.opencontainers.image.description="Serveur d'identité Keycloak avec thèmes et realm CFAO Needs embarqués" \
      org.opencontainers.image.vendor="CFAO Mobility" \
      org.opencontainers.image.version="0.1.1"

# Embarque les thèmes personnalisés CFAO (fond d'écran, logos, CSS, selecteur de langue)
COPY themes /opt/keycloak/themes

# Embarque le realm cfao-needs pré-configuré
COPY cfao-needs-realm.json /opt/keycloak/data/import/cfao-needs-realm.json

# Script de bootstrap idempotent et de relai des signaux (SIGTERM/SIGINT)
COPY --chmod=755 bootstrap-keycloak.sh /opt/keycloak/bin/bootstrap-keycloak.sh

ENTRYPOINT ["/opt/keycloak/bin/bootstrap-keycloak.sh"]
CMD ["start-dev", "--import-realm"]
