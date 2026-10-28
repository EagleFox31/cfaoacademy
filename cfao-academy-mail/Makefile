.PHONY: help up down logs test seed migrate shell

help:
	@echo "  make up       — docker compose up -d --build"
	@echo "  make down     — arrête les conteneurs"
	@echo "  make logs     — journaux mail-api"
	@echo "  make test     — pytest (hôte, SQLite)"
	@echo "  make seed     — templates email v1"
	@echo "  make migrate  — migrations dans le conteneur"

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f mail-api

test:
	cd api && (test -x .venv/Scripts/python.exe || python -m venv .venv)
	cd api && .venv/Scripts/python.exe -m pip install -q -r requirements-dev.txt
	cd api && .venv/Scripts/python.exe -m pytest -q

seed:
	docker compose exec mail-api python manage.py seed_email_templates

migrate:
	docker compose exec mail-api python manage.py migrate

shell:
	docker compose exec mail-api python manage.py shell
