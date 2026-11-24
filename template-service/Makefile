.PHONY: help up down logs test policy-test migrate shell

help:
	@echo "Commandes disponibles pour le service détachable :"
	@echo "  make up           - Démarre la stack en arrière-plan (API, DB, Cerbos)"
	@echo "  make down         - Arrête les conteneurs"
	@echo "  make logs         - Affiche les logs en continu"
	@echo "  make test         - Lance la suite de tests unitaires (pytest)"
	@echo "  make policy-test  - Compile et valide les règles Cerbos"
	@echo "  make migrate      - Rejoue le job service-migrate (schema + referentiel manquant)"
	@echo "  make shell        - Ouvre un shell interactif dans le conteneur API"

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

test:
	docker compose exec service-api pytest -v

policy-test:
	docker run --rm -v "$$(pwd)/cerbos:/cerbos" ghcr.io/cerbos/cerbos:0.40.0 compile --tests=/cerbos/tests /cerbos/policies

migrate:
	docker compose run --rm service-migrate

shell:
	docker compose exec service-api python manage.py shell
