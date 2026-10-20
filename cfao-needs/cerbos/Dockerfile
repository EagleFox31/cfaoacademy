FROM ghcr.io/cerbos/cerbos:0.40.0

LABEL org.opencontainers.image.title="CFAO Needs Cerbos" \
      org.opencontainers.image.description="Moteur de politiques Cerbos avec règles CFAO Needs embarquées" \
      org.opencontainers.image.vendor="CFAO Mobility" \
      org.opencontainers.image.version="0.1.0"

# Embarque les politiques de contrôle d'accès
COPY policies /policies

# Embarque la configuration du serveur Cerbos
COPY cerbos.yaml /config/cerbos.yaml

ENTRYPOINT ["/cerbos"]
CMD ["server", "--config=/config/cerbos.yaml"]
