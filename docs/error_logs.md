# Journal d'erreurs

Commandes qui ont échoué pendant les correctifs `cfao-academy-mail` du 27/10/2026, et ce qui a été fait ensuite. Une entrée d'échec n'est pas une preuve de succès. Les sorties vertes sont dans `walkthrough/15-cfao-academy-mail-amorcage.md`.

## 2026-10-27 — contrat OpenAPI, références jsonschema

- Commande : `cfao-academy-mail/api/.venv/Scripts/python.exe -m pytest -q` dans `cfao-academy-mail/api`.
- Résultat : 1 failed, 24 passed. Seul `outbound/tests/test_contract.py::test_server_matches_published_contract`.
- Erreur : `referencing.exceptions.PointerToNowhere` sur `/components/schemas/EmailList`. Le test réécrivait `#/components/schemas/` seulement sur le `oneOf` de tête. Les `$ref` imbriqués dans `$defs` restaient des pointeurs OpenAPI.
- Correctif : `_enqueue_schema` réécrit ces préfixes sur tout le document regroupé (`oneOf` + `$defs`).
- Rejeu : `25 passed in 1.79s`, puis avec `MAIL_SECRET_KEY` absent : `25 passed in 16.07s`.

## 2026-10-27 — `make` absent du PATH

- Commande : `make test-mail` à la racine, après `MAIL_SECRET_KEY set: False`.
- Erreur : `CommandNotFoundException`. `make` n'est pas une commande de ce PowerShell. Aucun `make.exe` trouvé sous Git, MSYS2, Scoop ou GnuWin32.
- Suite : `pip install -q -r requirements-dev.txt` via le venv est resté sans sortie et a été arrêté (processus 5728). Pytest seul, même venv, même absence de `MAIL_SECRET_KEY` : `25 passed in 16.07s`.
- `make test-mail` n'a pas tourné.

## 2026-10-27 — Docker Hub, poignée TLS

- `docker version` : serveur 29.5.3. `HTTP_PROXY` et `HTTPS_PROXY` vides.
- `docker compose up -d --build` dans `cfao-academy-mail` (`.env` local, `MAIL_EMAIL_BACKEND=console`) : deux échecs avant le build.
- Erreur : `failed to fetch oauth token: Post "https://auth.docker.io/token": net/http: TLS handshake timeout` en lisant les métadonnées de `python:3.12-slim`.
- `docker pull python:3.12-slim` : même timeout, compte registry `antifragile237`, code de sortie 1.
- Cache local : `postgres:16-alpine` et `postgres:15-alpine` seulement. Pas d'image `python`.
- Conséquence au matin : `mail-worker` n'a pas démarré. Aucun enqueue Docker. Aucun log `SENT`.
- Suite, le jour même : `python:3.12-slim` téléchargée hors du proxy Docker Desktop (empreintes vérifiées, `docker load`). `docker pull` normal reste en échec. Les trois services sont passés `healthy`. Enqueue console `rapports:smoke-20261027:steps` : réponse `APPROVED`, puis `status = SENT` en base, ligne `[mail]` dans les logs du worker. Sortie complète dans `walkthrough/15-cfao-academy-mail-amorcage.md`.
