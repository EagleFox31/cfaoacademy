FROM python:3.12-slim

LABEL org.opencontainers.image.title="CFAO Needs API" \
      org.opencontainers.image.description="API backend Django pour CFAO Needs" \
      org.opencontainers.image.vendor="CFAO Mobility" \
      org.opencontainers.image.version="0.1.0"

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

EXPOSE 8000

# Interdit n° 10 : migration et amorçage ne sont PAS dans l'entrypoint.
# Academix enchaînait `alembic upgrade head && seed_all` à chaque démarrage de
# conteneur ; acceptable en développement, risqué en production. Ici les deux sont
# des commandes explicites (`make migrate`, `make seed`).
# 2 workers : ~100 utilisateurs sur une campagne de six semaines, pas un site public.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
