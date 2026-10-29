# Service des comptes rendus formateur (story 04-5) : apercu des diapositives,
# production du rapport PPTX/PDF, brouillons et moteur de redaction.
# Contexte de build : ce dossier (`api/`). Voir docs/MODULE_RAPPORTS_FORMATEUR.md.

# -- Dependances Python, construites a part : l'image finale n'a ni pip ni cache.
FROM python:3.12-slim AS dependances
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
COPY requirements.txt /tmp/requirements.txt
RUN /opt/venv/bin/pip install -r /tmp/requirements.txt

# -- Image d'execution.
FROM python:3.12-slim

# LibreOffice convertit les diapositives (Impress) et les classeurs des
# graphiques (Calc : sans lui, la conversion echoue sans bruit et les
# graphiques gardent les valeurs du modele). Liberation et Carlito ont les
# memes metriques qu'Arial et Calibri ; `polices.conf` y renvoie les polices
# du modele absentes sous Linux.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libreoffice-impress libreoffice-calc fonts-liberation fonts-crosextra-carlito curl \
 && rm -rf /var/lib/apt/lists/*
COPY polices.conf /etc/fonts/conf.d/60-cfao-polices.conf
RUN fc-cache -f

# Utilisateur sans privilege ; LibreOffice a besoin d'un dossier personnel.
RUN useradd --create-home --uid 1000 service \
 && mkdir -p /donnees \
 && chown service:service /donnees

COPY --from=dependances /opt/venv /opt/venv
WORKDIR /app
COPY --chown=service:service . /app/

ENV PATH=/opt/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.base \
    CR_SOFFICE=/usr/bin/soffice \
    CR_DONNEES=/donnees \
    CR_CACHE=/tmp/cr-cache

USER service
EXPOSE 5175

# Un seul processus : le verrou LibreOffice et les taches de fond vivent en
# memoire. Les fils absorbent les requetes simultanees ; le long delai couvre
# un rapport complet produit sans tache de fond.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py compte_technique && exec gunicorn config.wsgi:application --bind 0.0.0.0:5175 --workers 1 --threads 8 --timeout 300 --access-logfile -"]
