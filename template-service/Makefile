.PHONY: help up down logs test policy-test migrate seed shell

help:
	@echo "Commandes disponibles pour le service détachable :"
	@echo "  make up           - Démarre la stack en arrière-plan (API, DB, Cerbos)"
	@echo "  make down         - Arrête les conteneurs"
	@echo "  make logs         - Affiche les logs en continu"
	@echo "  make test         - Lance la suite de tests unitaires (pytest)"
	@echo "  make policy-test  - Compile et valide les règles Cerbos"
	@echo "  make migrate      - Applique les migrations de base de données"
	@echo "  make seed         - Charge les données de test locales"
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
	docker compose exec service-api python manage.py migrate

seed:
	docker compose exec service-api python manage.py loaddata sample_fixtures.json

shell:
	docker compose exec service-api python manage.py shell
