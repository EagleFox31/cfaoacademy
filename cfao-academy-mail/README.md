# CFAO Academy Mail

Hub **inter-modules** d’emails transactionnels et de campagnes (needs, comptes-rendus, core, operations).

- **Producteurs** : `cfao-needs`, `cfao-comptes-rendus`, `cfao-core`, `cfao-operations` — via `POST /api/v1/mail/messages/enqueue` (clé service).
- **Responsabilités** : templates versionnés, file d’envoi, journal, retry, relecture MOA (campagnes needs).
- **Hors périmètre** : reset mot de passe utilisateur → Keycloak.

Modèle métier repris de `cfao-needs/api/outbound/` (F17 Academix), généralisé avec `source_app`, `correlation_id`.

## Démarrage local

```bash
cp .env.example .env   # renseigner MAIL_SECRET_KEY, MAIL_INBOUND_KEY, DB_PASSWORD
make up
make seed
curl -s http://127.0.0.1:5180/api/v1/mail/healthz
```

## Enqueue (service → service)

```http
POST /api/v1/mail/messages/enqueue
X-Mail-Service-Key: <MAIL_INBOUND_KEY>
Content-Type: application/json

{
  "kind": "rapports.cr_steps_missing",
  "source_app": "rapports",
  "source_ref": "brouillon:abc-123",
  "correlation_id": "rapports:abc-123:steps",
  "to": ["formateur@filiale.cfao.com"],
  "reply_to": "formateur.referent@cfao.com",
  "locale": "fr",
  "context": {
    "display_name": "Damas Ngue Lah",
    "brand": "TOYOTA",
    "session_code": "TS04-G3",
    "level": "G3",
    "training_title": "Révision/réparation des organes châssis des véhicules, partie 1 (Boites de vitesse et Différentiel)",
    "session_date": "19 au 23 janvier 2026",
    "country": "Togo",
    "missing_pages": "Résultats, Photos",
    "module_url": "https://<hôte-du-module>/portail/compte-rendu/nouveau?session=<id>"
  }
}
```

Réponse `201` + `id` ; `200` si `correlation_id` déjà en file (idempotence).

Relais par défaut : `smtp.cfao.corp:25`, expéditeur `helpdeskcm@cfao.com`, sans authentification. `reply_to` est optionnel et vient de l'appelant (champ dédié, ou `context.reply_to`). Sans valeur, l'en-tête Reply-To n'est pas posé.

`module_url` est l'adresse absolue du bouton. Elle vient du module (champ dédié, ou `context.module_url`). Pour un compte rendu, un appel sans `display_name`, `brand`, `session_code`, `level`, `training_title`, `session_date`, `country` ou `module_url` est refusé (`400`) : le mail n'est pas envoyé.

Le contrat publié est `api/outbound/contract/mail.openapi.json`, aussi servi par `GET /api/v1/mail/contract`.

## Intégration plateforme (à venir)

Service `mail` dans le `docker-compose.yml` racine, route gateway `/api/v1/mail/*`, variables `MAIL_INBOUND_KEY` partagées avec les consommateurs.
