FROM python:3.12-slim
# contracts:begin - bloc géré par contracts/sync.py, ne pas éditer
LABEL org.cfao.module="cfao-supervision"
# contracts:end

LABEL org.opencontainers.image.title="CFAO Supervision API" \
      org.opencontainers.image.description="Cockpit d'exploitation : état, versions et connexions des modules" \
      org.opencontainers.image.vendor="CFAO Mobility"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Aucune installation système (psycopg[binary]) : l'image se construit derrière un proxy.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin app
USER 10001

EXPOSE 8000

# Migration et référentiel : job ponctuel supervision-migrate (AGENTS.md §7).
# Collecteur : même image, commande « python manage.py collect ».
CMD ["gunicorn", "config.wsgi:application"]

# Version posée au build (scripts/build_image.py) ; en fin de fichier pour garder le cache.
ARG VERSION=dev
LABEL org.opencontainers.image.version="${VERSION}"
