# Plan : rubrique « Mes alertes » (page profil)

Plan établi le 19/11/2026 (agent architecte). Rien n'est implémenté.

## Décision

Les préférences d'alerte appartiennent à l'utilisateur, pas à un module : elles vont dans **cfao-core / identity**, sous `/api/v1/core/me/alerts`, sur le patron de `MeView`.

Le catalogue des alertes est déclaré dans le code et filtré par rôle. Seuls les choix qui s'écartent des valeurs par défaut sont stockés.

L'étape 1 livre le réglage et l'écran. Elle dit honnêtement que l'envoi n'est pas encore actif : aujourd'hui, aucune des 4 alertes ne part vers une personne précise.

## Existant

### Cloche

- `PortalNotificationsBell.jsx` / `NotificationItems` ne font qu'afficher.
- Les alertes sont calculées par chaque page, par exemple `CenterHome.jsx` `alertesCle` à partir de `planningApi.reviewItems`.
- Il n'y a ni boîte de réception côté serveur, ni état lu / non lu.

### E-mails

- Le hub d'envoi est `cfao-academy-mail/api/outbound/catalog.py` (types `identity.*`, `needs.*`, `rapports.*`, `core.session_reminder` ; tâches planifiées dans `ensure_mail_schedules.py`).
- cfao-needs a sa propre file d'envoi : `cfao-needs/api/outbound/services/queue.py`.

### État des 4 alertes

1. **Besoins reçus d'une filiale** : en partie.
   - cfao-needs envoie `internal_submission_summary` à une liste fixe (`ACADEMY_TEAM_RECIPIENTS`), sans tenir compte des préférences de chacun.
   - Le bon point de déclenchement est `cfao-planning/.../services/needs_copy.py`.
2. **Devis à valider** : rien n'existe.
   - Le devis n'a que les états DRAFT et FROZEN (`planning/models.py:174`).
   - **Décision métier à obtenir** : quel moment veut dire « attend sa validation » ?
3. **Formateur avec deux formations rapprochées** : le calcul existe, pas l'événement.
   - `services/trainer_load.py` (`MIN_GAP_DAYS = 14`) calcule à la lecture.
   - Il n'y a ni tâche planifiée ni mémoire de ce qui a déjà été signalé.
4. **Formateur qui demande de l'aide** : rien côté serveur (l'assistance n'existe que dans le front).

## Étape 1 : catalogue, préférences et rubrique

1. **Catalogue** : `cfao-core/identity/alerts.py`.
   - Clés : `needs_received`, `quote_pending`, `trainer_close_sessions`, `trainer_help`.
   - Rôle : `training_coordinator`.
   - `active=False` partout.
   - Défauts : dans l'application et tout de suite, sauf les formations rapprochées (résumé du matin).
   - Valeurs : canal `app` / `email` / `both`, rythme `now` / `morning`.
   - Fonction `for_roles(roles)`.
2. **Modèle** : `identity/models.py` `AlertPreference(UUIDModel, TimeStampedModel)`.
   - Champs `subject` (keycloak_sub, sans clé étrangère), `alert_key`, `channel`, `rhythm`.
   - `UniqueConstraint(subject, alert_key)` et CheckConstraint sur les valeurs permises.
3. **Migration** : `identity/migrations/0003_alert_preference.py`, générée par makemigrations.
   - Création de la table seulement. Le job `core-migrate` existe déjà (docker-compose.yml:181), ce qui couvre AGENTS.md §7.
4. **Vue** : `MyAlertsView` dans `identity/views.py`, sur le patron `MeView`, ressource Cerbos `alert_preference`.
   - GET : `[{key, channel, rhythm, active, isDefault}]`.
   - PUT `/me/alerts/<key>` :
     - clé hors du catalogue de ses rôles : 404 ;
     - valeur invalide : 400 ;
     - choix égal au défaut : la ligne est supprimée ;
     - sinon `update_or_create`.
   - Le serializer va dans `serializers.py`.
5. **Routes** : `identity/urls.py`, ajouter `me/alerts` et `me/alerts/<slug:key>` avant le routeur.
6. **Politique Cerbos** : `cerbos/policies/resource_policies/alert_preference.yaml`.
   - Actions `view:self` et `update:self`, condition `principal.id == resource.id`, default-deny.
   - Recharger Cerbos après modification (leçon 39).
7. **Appels API** : `frontend/src/lib/api.js`, ajouter `myAlerts()` et `saveMyAlert(key, body)`.
8. **Hook** : `frontend/src/hooks/useMyAlerts.js`.
   - Avec `OIDC_ACTIF` : appels à l'API.
   - En démo : catalogue local et localStorage `cfao.alerts.<username>`.
   - API en panne : afficher une erreur, jamais des défauts présentés comme enregistrés.
9. **Catalogue côté front** : `frontend/src/data/alertCatalog.js`, copie du catalogue, avec un test de parité avec `alerts.py`.
10. **Rubrique** : `pages/Profil.jsx`, entrée `alertes` (icône BellIcon), présente seulement si le rôle a des alertes.
    - Une `Row` par alerte, avec deux `ChipFilterBar` : « Où me prévenir » et « Quand ».
    - Pastille `portal-status-chip todo` « Pas encore envoyée » tant que `active` est faux.
11. **Textes** : clés i18n `profile.json` fr / en / pt.
12. **CSS** : `.profile-alert-*` dans `academy.css`.

### Textes

- **Titre** : « Mes alertes ».
- **Les 4 alertes** :
  - « Une filiale a envoyé ses besoins » ;
  - « Un devis attend votre validation » ;
  - « Un formateur a deux formations à moins de 2 semaines d'écart » ;
  - « Un formateur demande de l'aide ».
- **Où me prévenir** : « Dans l'application » / « Par e-mail » / « Les deux ».
- **Quand** : « Tout de suite » / « Un résumé chaque matin ».
- **Démo** : « Compte de démonstration : vos choix sont gardés sur cet appareil seulement. »
- **Interdit** à l'étape 1 : « vous serez prévenu ».

## Étapes suivantes (une PR chacune)

### Étape 2 : alertes dans l'application

- Boîte de réception `AlertInbox` dans core (champ `fingerprint` unique, `read_at`) et `GET /me/alerts/inbox`.
- Endpoint interne `POST /internal/alerts`, avec contrat `contracts/registry.json` et tests (leçon 33).
- Premiers émetteurs :
  - `needs_copy.py` ;
  - une tâche du matin sur `trainer_load.py`.
- La cloche fusionne cette boîte avec `alertesCle`.
- Chaque clé passe à `active=True` une par une.

### Étape 3 : e-mail et résumé du matin

- Nouveaux types dans le hub mail `catalog.py` : `alerts.immediate` et `alerts.morning_digest`.
- Tâche planifiée à 7 h (Douala), avec `correlation_id = subject + date`.
- La file a besoin d'un consommateur déclaré (leçon 12).

### Étape 4 : devis et assistance

- Devis : une fois l'événement défini avec l'utilisateur.
- Assistance : une fois que le module serveur existe.

## Tests

- **pytest** `cfao-core/identity/tests/test_alert_preferences.py` :
  - accès refusé : anonyme 401, refus Cerbos 403 ;
  - lecture : défauts quand rien n'est enregistré, liste vide pour un technicien ;
  - écriture : deux PUT donnent une seule ligne ; un PUT avec la valeur par défaut supprime la ligne ;
  - erreurs : clé d'un autre rôle 404, valeur invalide 400 ;
  - un utilisateur sans ligne User fonctionne ;
  - parité du catalogue avec le front.
- **Cerbos** `cerbos/tests/alert_preference_test.yaml` :
  - accès à ses propres préférences : permis ;
  - accès à celles d'un autre : refusé ;
  - compte externe : limité aux siennes ;
  - rôles cumulés ;
  - preuve par mutation.
- **vitest** :
  - `useMyAlerts.test.js` : API, démo, erreur ;
  - `Profil.test.jsx` : rubrique présente ou absente selon le rôle, un clic appelle `saveMyAlert`, pastille affichée, mention démo affichée.
- **Preuve §7** :
  - `core-migrate` sur une base vide, puis une seconde fois : « No migrations to apply » ;
  - rejeu sur une copie de la recette ;
  - `npm run build` dans `frontend/`.

## Risques

- **Recette** : core n'est exposé que si `EDGE_CORE_UPSTREAM` est renseigné (`edge/entrypoint.d/25-modules-actifs.sh`). Vérifier que core tourne sur 8088.
- **Audience du jeton** : `OIDC_AUDIENCE=cfao-core-api`. À valider avec un vrai jeton du coordinateur.
- **Doublons d'e-mails** : `ACADEMY_TEAM_RECIPIENTS` (cfao-needs) doublera l'alerte besoins à l'étape 3. Décider s'il faut le garder.
