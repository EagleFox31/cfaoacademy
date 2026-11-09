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

# LibreOffice convertit les diapositives ; Calc rend les classeurs embarques
# (graphiques et tableaux), sans lui leurs images restent celles du modele.
# Polices : celles de Windows (Arial, Arial Black, depot contrib, licence
# Microsoft acceptee) et Carlito (metrique de Calibri), pour retrouver les
# substitutions du rendu Windows (docs/etude-polices-rendu.md).
RUN sed -i 's/^Components: main$/Components: main contrib/' /etc/apt/sources.list.d/debian.sources \
 && echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      libreoffice-impress libreoffice-calc fonts-liberation fonts-crosextra-carlito \
      ttf-mscorefonts-installer curl \
 && rm -rf /var/lib/apt/lists/*
COPY polices.conf /etc/fonts/conf.d/99-cr-polices.conf
# Controle bloquant : chaque police du modele doit tomber sur la police voulue.
RUN fc-cache -f >/dev/null && for paire in \
      "Gotham Black=Arial Black" "Arial=Arial" "Arial Nova=Carlito" \
      "Arial Nova Light=Carlito" "Brandon Grotesque Medium=Carlito" "Calibri=Carlito"; do \
      voulue="${paire#*=}"; obtenue="$(fc-match -f '%{family[0]}' "${paire%%=*}")"; \
      [ "$obtenue" = "$voulue" ] || { echo "Police ${paire%%=*} : $obtenue au lieu de $voulue"; exit 1; }; \
    done

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
# un rapport complet produit sans tache de fond. Schema et compte technique :
# job `migrate` du compose (AGENTS.md section 7), jamais au demarrage de l'API.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:5175", "--workers", "1", "--threads", "8", "--timeout", "300", "--access-logfile", "-"]
