# CFAO Academy — commandes courantes (Make)
# Usage : make <cible>   (GNU Make ou compatible)
COMPOSE = docker compose

.PHONY: help dev-frontend dev-stack test test-cerbos test-core test-ops test-frontend test-rapports test-cr-web test-mail \
        up down reset build ps logs seed migrate mm shell dtest dtest-cerbos cerbos-reload restart token \
        rapports-importer medacap-api-test medacap-api-deploy

help:
	@echo "── CI / build (hôte) ──"
	@echo "  make dev-frontend   — Vite dev server (frontend/)"
	@echo "  make dev-stack      — docker compose up --build"
	@echo "  make test           — Tous les tests (Cerbos + core + ops + frontend + rapports + interface du module)"
	@echo "  make test-cerbos    — Compile + tests du bundle Cerbos unique (socle, needs, rapports)"
	@echo "  make test-core      — pytest cfao-core"
	@echo "  make test-ops       — typecheck + vitest + build cfao-operations"
	@echo "  make test-frontend  — build Vite frontend"
	@echo "  make test-rapports  — pytest cfao-comptes-rendus"
	@echo "  make test-cr-web    — vitest + build de l'interface cfao-comptes-rendus/web"
	@echo "  make test-mail      — pytest cfao-academy-mail"
	@echo "── Dev (stack en marche) ──"
	@echo "  make up | down | reset | build | ps | logs [S=svc]"
	@echo "  make seed | migrate | mm [M=app] | shell"
	@echo "  make dtest          — pytest dans le conteneur core"
	@echo "  make dtest-cerbos   — compile policies dans le conteneur cerbos"
	@echo "  make cerbos-reload  — recharge les policies (après modif)"
	@echo "  make rapports-importer SOURCE=/donnees — reprend les brouillons de l'ancien service"
	@echo "  make token U=aminata.kone — récupère un access token"
	@echo "── MEDACAP (Mesure) ──"
	@echo "  make medacap-api-test   — sonde evaluations.php (local + 10.68.0.7)"
	@echo "  make medacap-api-deploy — copie views/measure/api vers Y:\\ (prod)"

# ── MEDACAP bridge ────────────────────────────────────────────────
MEDACAP_API_KEY ?= demo-cfao-portal
MEDACAP_USER ?= test

medacap-api-test:
	@curl -s "http://localhost/medacap/views/measure/api/evaluations.php?key=$(MEDACAP_API_KEY)&username=$(MEDACAP_USER)" || true
	@echo.
	@curl -s -o NUL -w "10.68.0.7 HTTP %%{http_code}\n" "http://10.68.0.7/medacap/views/measure/api/evaluations.php?key=$(MEDACAP_API_KEY)&username=$(MEDACAP_USER)"

medacap-api-deploy:
	powershell -NoProfile -Command "New-Item -ItemType Directory -Force -Path 'Y:\views\measure\api' | Out-Null; Copy-Item 'C:\wamp64\www\MEDACAP\views\measure\api\*' 'Y:\views\measure\api\' -Force; Get-ChildItem 'Y:\views\measure\api' -Name"

# ── CI / build (hôte) ─────────────────────────────────────────────
dev-frontend:
	cd frontend && npm ci && npm run dev

dev-stack:
	$(COMPOSE) up --build

test: test-cerbos test-core test-ops test-frontend test-rapports test-cr-web test-mail

test-cerbos:
	MSYS_NO_PATHCONV=1 docker run --rm -v "$(CURDIR)/cerbos:/work" \
		ghcr.io/cerbos/cerbos:0.40.0 compile --tests=/work/tests /work/policies

test-core:
	cd cfao-core && pip install -r requirements.txt && pytest -q

test-ops:
	cd cfao-operations && npm ci && npm run typecheck && npm test && npm run build

test-frontend:
	cd frontend && npm ci && npm run build

test-rapports:
	cd cfao-comptes-rendus/api && pip install -r requirements-dev.txt && pytest -q

test-cr-web:
	cd cfao-comptes-rendus/web && npm ci && npm test && npm run build

test-mail:
	cd cfao-academy-mail/api && (test -x .venv/Scripts/python.exe || python -m venv .venv)
	cd cfao-academy-mail/api && .venv/Scripts/python.exe -m pip install -q -r requirements-dev.txt
	cd cfao-academy-mail/api && .venv/Scripts/python.exe -m pytest -q

# ── Dev (stack en marche, code hot-monté via override) ────────────
up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

reset:
	$(COMPOSE) down -v

build:
	$(COMPOSE) up -d --build

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=100 $(S)

seed:
	$(COMPOSE) exec -T core python manage.py seed_dev

migrate:
	$(COMPOSE) exec -T core python manage.py migrate

mm:
	$(COMPOSE) exec -T core python manage.py makemigrations $(M)

shell:
	$(COMPOSE) exec core python manage.py shell

dtest:
	$(COMPOSE) exec -T core pytest -q

dtest-cerbos:
	MSYS_NO_PATHCONV=1 $(COMPOSE) exec -T cerbos /cerbos compile --tests=/tests /policies

cerbos-reload:
	$(COMPOSE) restart cerbos

rapports-importer:
	$(COMPOSE) exec -T rapports python manage.py importer_flask --source $(SOURCE)

restart:
	$(COMPOSE) restart $(S)

token:
	@$(COMPOSE) exec -T core sh -c 'curl -s -X POST http://keycloak:8080/realms/cfao/protocol/openid-connect/token \
	  -d grant_type=password -d client_id=cfao-spa -d username=$(U) -d password=demo -d scope=openid \
	  | sed -n "s/.*\"access_token\":\"\([^\"]*\)\".*/\1/p"'
