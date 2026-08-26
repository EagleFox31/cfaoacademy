FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Interdit n° 10 : migration et amorçage ne sont PAS dans l'entrypoint.
# Academix enchaînait `alembic upgrade head && seed_all` à chaque démarrage de
# conteneur ; acceptable en développement, risqué en production. Ici les deux sont
# des commandes explicites (`make migrate`, `make seed`).
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
