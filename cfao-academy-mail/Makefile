.PHONY: help up down logs test migrate shell

help:
	@echo "  make up       — docker compose up -d --build"
	@echo "  make down     — arrête les conteneurs"
	@echo "  make logs     — journaux mail-api"
	@echo "  make test     — pytest (hôte, SQLite)"
	@echo "  make migrate  — rejoue le job mail-migrate (migrations + modèles v1 manquants)"

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

migrate:
	docker compose run --rm mail-migrate

shell:
	docker compose exec mail-api python manage.py shell
