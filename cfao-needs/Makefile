# Raccourcis du module détachable. Toutes les commandes sont explicites :
# rien n'est fait automatiquement au démarrage d'un conteneur (interdit n° 10).

COMPOSE = docker compose -f docker-compose.yml

.PHONY: up down logs migrate seed test policy-test build-web

up:            ## Monte la stack complète
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f needs-api needs-worker

migrate:       ## Applique les migrations (JAMAIS dans l'entrypoint)
	$(COMPOSE) exec needs-api python manage.py migrate

seed:          ## Charge référentiel + templates d'emails (commande explicite)
	$(COMPOSE) exec needs-api python manage.py seed_referential
	$(COMPOSE) exec needs-api python manage.py seed_email_templates

test:          ## Tests Python
	cd api && .venv/Scripts/python.exe -m pytest -q

policy-test:   ## Tests Cerbos — positifs ET négatifs, obligatoires
	# MSYS_NO_PATHCONV : sous Git Bash, /work/* est sinon converti en chemin Windows.
	MSYS_NO_PATHCONV=1 docker run --rm -v "$(CURDIR)/cerbos:/work" ghcr.io/cerbos/cerbos:0.38.1 \
	  compile --tests=/work/tests /work/policies

build-web:
	cd web && npm ci && npm run build
