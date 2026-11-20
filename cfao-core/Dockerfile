FROM python:3.12-slim
# contracts:begin - bloc géré par contracts/sync.py, ne pas éditer
LABEL org.cfao.contracts.consumes="needs-analytics@^1" \
      org.cfao.module="cfao-core"
# contracts:end

# Prod par défaut : sans variable, l'image refuse de démarrer sans clé ni hôtes.
# Dev, recette et tests fixent leur DJANGO_SETTINGS_MODULE.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Sans root : l'API n'écrit nulle part dans /app (pas de .pyc, pas de médias),
# elle n'a donc besoin que de lire son code.
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin service
USER 10001

EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--access-logfile", "-"]

# Version posée au build (scripts/build_image.py) ; en fin de fichier pour garder le cache.
ARG VERSION=dev
LABEL org.opencontainers.image.version="${VERSION}"
