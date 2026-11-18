# CFAO Academy Mail

Hub **inter-modules** d’emails transactionnels et de campagnes (needs, comptes-rendus, core, operations).

- **Producteurs** : `cfao-needs`, `cfao-comptes-rendus`, `cfao-core`, `cfao-operations` — via `POST /api/v1/mail/messages/enqueue` (clé service).
- **Responsabilités** : templates versionnés, file d’envoi, journal, retry, relecture MOA (campagnes needs).
- **Mails de Keycloak** : Keycloak décide (code, lien, mot de passe oublié) ; le hub ne fait que porter le mail, en message sensible (voir plus bas).

Modèle métier repris de `cfao-needs/api/outbound/` (F17 Academix), généralisé avec `source_app`, `correlation_id`.

## Démarrage local

```bash
cp .env.example .env   # renseigner MAIL_SECRET_KEY, MAIL_INBOUND_KEY, DB_PASSWORD
make up               # le job mail-migrate crée le schéma et les modèles v1
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

Le contrat publié est `api/outbound/contract/mail.openapi.json`, aussi servi par `GET /api/v1/mail/contract`. Après un changement du catalogue : `python -m outbound.contract` (depuis `api/`) le réécrit ; un test refuse un fichier qui diffère d'un octet.

Langues : `fr`, `en`, `pt` (`LOCALES` du catalogue). `seed_email_templates` ajoute les gabarits manquants et n'écrase jamais un gabarit existant.

## Messages sensibles (codes et liens de Keycloak)

Types `identity.login_code`, `identity.password_reset`, `identity.execute_actions`, `identity.verify_email` :

- Seule une clé liée à la source `cfao-identity` (`MAIL_INBOUND_KEYS`) peut les envoyer ; la clé commune reçoit `403`.
- `expires_at` est obligatoire (au plus `MAIL_SENSITIVE_MAX_TTL_MINUTES`), `cc` est interdit.
- Le code et le lien (`x-secret-context` du contrat) sont chiffrés (Fernet, `MAIL_SEALED_CONTEXT_KEY`) puis effacés à l'envoi. Le rendu gardé en base les remplace par `••••••`. L'objet et l'aperçu ne contiennent jamais de secret.
- Le message part une seule fois : pas de renvoi, pas de relecture. Échu avant l'envoi, il passe en `EXPIRED` ; la purge planifiée (toutes les 5 min, créée par `mail-migrate`) efface les secrets restants.
- Le code doit faire 6 chiffres ; un champ mal formé est refusé sans que sa valeur soit citée.

`identity.login_support_alert` prévient le support d'une demande de connexion sans suite. Il part seul si tous les destinataires sont internes. Keycloak passe un `correlation_id` par adresse et par jour : un second appel le même jour ne renvoie rien (`200`).

### Côté Keycloak (extension `cfao-hub`, `keycloak/spi/`)

- L'image Keycloak choisit le fournisseur `cfao-hub`. Il devient actif avec `KC_SPI_EMAIL_TEMPLATE__CFAO_HUB__URL` (ex. `http://mail-api:5180`) et `KC_SPI_EMAIL_TEMPLATE__CFAO_HUB__SERVICE_KEY` (la clé `cfao-identity` de `MAIL_INBOUND_KEYS`). Sans ces deux variables, Keycloak garde ses propres mails. Avec une seule, il refuse de démarrer.
- L'envoi est asynchrone. Hub joignable ou non, adresse connue ou non, la réponse de Keycloak est la même. Un échec est journalisé dans Keycloak sans le lien, et l'utilisateur redemande un lien.
- Réseau : Keycloak et `mail-api` partagent `cfao-maillage`. L'hôte de `KC_HOSTNAME` doit figurer dans `MAIL_ALLOWED_LINK_HOSTS`.
- Le smoke `keycloak/tests/smoke_hub_mail.py` (pile `keycloak/tests/compose.hub.smoke.yml`) déroule « mot de passe oublié » de bout en bout.

## Intégration plateforme (à venir)

Service `mail` dans le `docker-compose.yml` racine, route gateway `/api/v1/mail/*`, variables `MAIL_INBOUND_KEY` partagées avec les consommateurs.
