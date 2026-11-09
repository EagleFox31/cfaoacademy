# Raccourcis du module détachable. Aucune migration dans l'entrypoint (interdit
# n° 10) : le job ponctuel needs-migrate crée la base à chaque `up` (AGENTS.md §7).

COMPOSE = docker compose -f docker-compose.yml

.PHONY: up down logs migrate seed-demo-open test policy-test build-web

up:            ## Monte la stack complète
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f needs-api needs-worker

migrate:       ## Rejoue le job de création de base (no-op si à jour)
	$(COMPOSE) run --rm needs-migrate

seed-demo-open: ## Recette : démo + campagne ouverte, saisissable tout de suite
	$(COMPOSE) run --rm needs-migrate python manage.py bootstrap --demo --open

test:          ## Tests Python
	cd api && .venv/Scripts/python.exe -m pytest -q

policy-test:   ## Tests Cerbos — positifs ET négatifs, obligatoires
	# MSYS_NO_PATHCONV : sous Git Bash, /work/* est sinon converti en chemin Windows.
	# Bundle commun de la plateforme (../cerbos) : un seul PDP pour tous les modules.
	MSYS_NO_PATHCONV=1 docker run --rm -v "$(CURDIR)/../cerbos:/work" ghcr.io/cerbos/cerbos:0.40.0 \
	  compile --tests=/work/tests /work/policies

build-web:
	cd web && npm ci && npm run build
