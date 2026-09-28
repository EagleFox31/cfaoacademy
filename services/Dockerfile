# Service des rapports formateur (story 04-5) : apercu des diapositives,
# production du rapport PPTX/PDF, brouillons et moteur de redaction.
# Voir docs/MODULE_RAPPORTS_FORMATEUR.md.
FROM python:3.12-slim

# LibreOffice convertit les diapositives ; les polices Liberation et Carlito
# ont les memes metriques qu'Arial et Calibri, utilisees par le modele.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libreoffice-impress fonts-liberation fonts-crosextra-carlito curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apercu/ apercu/
COPY redaction/ redaction/

ENV CR_HOTE=0.0.0.0 \
    CR_PORT=5175 \
    CR_SOFFICE=/usr/bin/soffice \
    PYTHONUNBUFFERED=1

WORKDIR /srv/apercu
EXPOSE 5175
CMD ["python", "api.py"]
