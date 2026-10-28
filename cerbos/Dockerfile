# PDP Cerbos unique de la plateforme, politiques embarquees : en prod, rien n'est
# monte depuis le disque du serveur. Contexte de build : cerbos/.
# Image : antifragile237/cfao-cerbos:<tag> (un nouveau tag par changement).
FROM ghcr.io/cerbos/cerbos:0.40.0

LABEL org.opencontainers.image.title="CFAO Cerbos" \
      org.opencontainers.image.description="PDP Cerbos commun : socle, needs, comptes rendus, planning" \
      org.opencontainers.image.vendor="CFAO Mobility"

COPY policies /policies
COPY config.yaml /config/config.yaml

CMD ["server", "--config=/config/config.yaml"]
