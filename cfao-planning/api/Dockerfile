FROM python:3.12-slim
# contracts:begin - bloc géré par contracts/sync.py, ne pas éditer
LABEL org.cfao.contracts.consumes="needs-analytics@^1.5" \
      org.cfao.contracts.provides="needs-snapshot-push@1.0.0" \
      org.cfao.module="cfao-planning"
# contracts:end

LABEL org.opencontainers.image.title="CFAO Planning API" \
      org.opencontainers.image.description="API backend Django pour CFAO Planning (planning des formateurs)" \
      org.opencontainers.image.vendor="CFAO Mobility"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Aucune installation systeme : `psycopg[binary]` embarque ses roues
# precompilees, donc ni build-essential ni libpq-dev ne sont necessaires.
# Et pas de curl : la sonde de sante passe par Python, deja present.
#
# Ce n'est pas qu'une optimisation. Un build qui depend de deb.debian.org
# echoue derriere un proxy d'entreprise — ce poste a renvoye 403 sur les
# depots Debian, et le reseau CFAO fera probablement pareil. Une image qui
# ne se construit que depuis un poste ouvert sur Internet n'est pas livrable.

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Sans root : l'API n'écrit nulle part dans /app, elle ne fait que lire son code.
# Le job planning-migrate repasse en root dans le compose, pour lire le partage.
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin service
USER 10001

EXPOSE 8000

# Interdit n° 10 : migration et amorçage ne sont PAS dans l'entrypoint.
# Academix enchaînait `alembic upgrade head && seed_all` à chaque démarrage de
# conteneur ; acceptable en développement, risqué en production. Ici les deux
# tournent dans le job ponctuel `planning-migrate` du docker-compose (AGENTS.md §7).
# 2 workers × 4 threads et préchauffage des clés OIDC : voir gunicorn.conf.py.
CMD ["gunicorn", "config.wsgi:application"]

# Version posée au build (scripts/build_image.py) ; en fin de fichier pour garder le cache.
ARG VERSION=dev
LABEL org.opencontainers.image.version="${VERSION}"
