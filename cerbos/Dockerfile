# PDP Cerbos unique de la plateforme, politiques embarquees : en prod, rien n'est
# monte depuis le disque du serveur. Contexte de build : cerbos/.
# Image : antifragile237/cfao-cerbos:<tag> (un nouveau tag par changement).
FROM ghcr.io/cerbos/cerbos:0.40.0

LABEL org.opencontainers.image.title="CFAO Cerbos" \
      org.opencontainers.image.description="PDP Cerbos commun : socle, needs, comptes rendus, planning" \
      org.opencontainers.image.vendor="CFAO Mobility"

# Hors de /policies : l'image de base le déclare en VOLUME. Un conteneur recréé sans `-V`
# gardait le volume anonyme de l'ancienne version, donc ses anciennes politiques.
COPY policies /cfao/policies
COPY config.yaml /config/config.yaml

# config.yaml reste commun au dev (politiques montées sur /policies) : seule l'image change de dossier.
CMD ["server", "--config=/config/config.yaml", "--set=storage.disk.directory=/cfao/policies"]

# Version posée au build (scripts/build_image.py) ; en fin de fichier pour garder le cache.
ARG VERSION=dev
LABEL org.opencontainers.image.version="${VERSION}"
