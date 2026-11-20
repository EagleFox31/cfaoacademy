# Portail de l'assistante du centre de formation — cadrage (19/11/2026)

Statut : **validé le 19/11 et codé** (Prochaines sessions de formation · Vos dossiers · À consulter). Les sessions restent en construction tant que cfao-planning n'expose pas les sessions datées.

## Qui elle est

Rôle `center_assistant`, « Assistante du centre ». Il est déclaré dans `cfao-core/identity/roles.py:17` et dans le realm Keycloak, avec le compte de démo `assistante@cfao.com`.

Son métier est le **support administratif et logistique du centre** (`PLATFORM_ROLES.md:59`) :
- les fiches besoins des filiales : elle les relit, les valide, relance et saisit à leur place ;
- les inscriptions, les convocations, les salles ;
- la logistique de chaque stagiaire : vols, hôtel, navettes, visa, et le coût total pour refacturer la filiale ;
- les demandes d'assistance : elle les traite, y répond et les clôture.

Elle **exécute**, là où le directeur **décide** et le coordinateur **arbitre**. Son portail est donc un portail d'action, pas d'observation : il commence par ce qu'elle a à faire.

## Ses questions de tous les jours

1. Quelles fiches besoins dois-je relire, valider ou relancer ?
2. Quelles sessions commencent bientôt, et que manque-t-il : salle, convocations, hôtel ?
3. Qui est inscrit, et qui n'a pas encore reçu sa convocation ?
4. Combien coûte chaque stagiaire, pour refacturer sa filiale ?
5. Quelles demandes d'assistance attendent une réponse ?

## Sa place dans MEDACAP

| Étape | Ce qu'elle voit / fait | Source |
|---|---|---|
| Mesurer | Rien : elle n'a pas accès aux résultats des techniciens | matrice :121 |
| Exploiter | Rien | — |
| Définir | **Fait** : relit, valide et relance les fiches besoins de toutes les filiales, et approuve les envois. **Voit** la clé de répartition sans la modifier. | Cerbos `needs_submission`, `needs_outbound`, `planning_cost_key` (view) |
| Acquérir | **Fait, c'est le cœur de son métier** : sessions et salles, inscriptions, convocations, logistique et coût par stagiaire, calendrier annuel exportable | backlog 05-3, 05-5, 08-1, 08-2, 08-7, 11-4 |
| Certifier | **Fait** : prépare et envoie les attestations de fin de formation | décision métier 19/11 |
| Appliquer | **Fait** : demandes d'assistance (traiter, répondre, affecter, clôturer) | backlog 06-3 |
| Performer | Rien : le retour sur investissement relève du directeur | — |

## Ce qu'elle partage, ce qui ne la regarde pas

- **Partagé avec le coordinateur** : fiches besoins, clé de répartition (le coordinateur la modifie, elle la lit), calendrier, convocations, sessions du centre.
- **Coordinateur seul** : corriger les points de revue de la clé, administrer les offres et les tarifs, les imports et le gel de la clé.
- **Directeur seul** : devis des filiales, offres, rapports, retour sur investissement, avancement de la plateforme, charge des formateurs.
- **Formateur seul** : comptes rendus de session, feuilles d'émargement, présences. Elle n'a aucun droit sur les comptes rendus.

## Sections proposées (wording à valider)

Dans l'ordre :

1. **À faire aujourd'hui** : fiches à relire, envois à approuver, demandes d'assistance ouvertes, sessions proches incomplètes. Chaque ligne mène à l'action.
2. **Fiches besoins des filiales** : où en est chaque filiale (envoyée, à relire, validée, à relancer). C'est déjà possible avec cfao-needs.
3. **Prochaines sessions** : pour chaque session, la salle, le nombre d'inscrits, les convocations envoyées et l'hébergement. Les sessions existent dans cfao-planning ; les salles et convocations sont seulement annoncées.
4. **Inscriptions et convocations** : en construction (annoncé dans la matrice).
5. **Attestations de fin de formation** : à préparer et envoyer après chaque session. En construction.
6. **Logistique et coût par stagiaire** : en construction. C'est un manque connu (Academix F07). La refacturation à la filiale y est en lecture seule.
7. **Clé de répartition {année}** : en lecture seule. Existe.
8. **Calendrier annuel et salles** : avec export Excel. C'est elle qui arbitre les conflits de salles. Existe en partie (manque Academix F14).
9. **Demandes d'assistance** : tickets à traiter.

Aujourd'hui, elle passe par la page du centre (`CenterHome`, mode `assistant`), qui n'a que trois blocs : la clé, les outils et « bientôt ». La proposition ci-dessus la remplace.

## Version simplifiée proposée (UX) : 3 sections au lieu de 9

Pour qui : une utilisatrice lente, pressée, peu attentive, qui fait des erreurs. Trois règles :
- elle ne cherche rien : l'écran lui apporte ce qu'elle doit faire ;
- une ligne, une action, en un clic ;
- l'erreur est rendue impossible, plutôt qu'expliquée.

1. **Activité quotidienne** (décision utilisateur 19/11, remplace « À faire aujourd'hui »). Des tuiles fixes, toujours à la même place, une par tâche qui revient souvent :
   - Demandes d'assistance ;
   - Convocations à envoyer ;
   - Attestations à envoyer ;
   - Conflits de salles.

   Une **pastille rouge avec un nombre** s'affiche dès qu'il y a du nouveau. Sans nouveauté, la tuile reste sans pastille. Un clic sur la tuile mène à la liste. Les tuiles ne bougent jamais : elle les retrouve sans chercher.
2. **Mes sessions.** Une carte par session, regroupant les anciennes sections 3, 4, 5, 6 et 8. Chaque carte porte une liste à cocher qui suit la vie de la session :
   - avant : salle, inscrits, convocations, hôtel et vols ;
   - après : attestations.

   La pastille dit ce qui manque, par exemple « 2 choses à faire ». Le coût par stagiaire s'affiche dans le détail, en lecture seule.
3. **À consulter.** Deux cartes en lecture seule : le calendrier annuel et la clé de répartition. Elles sont placées en bas, parce qu'elle les consulte peu.

Les demandes d'assistance n'ont plus de section à part : elles ont leur tuile dans « Activité quotidienne », avec un lien « Voir toutes les demandes ».

### Garde-fous contre les erreurs
- **Ordre imposé** dans chaque session : pas de convocation tant que la salle n'est pas réservée, pas d'attestation tant que le formateur n'a pas saisi les présences.
- **Rien à écrire** : convocations et attestations partent de modèles pré-remplis (hub mail). Elle relit, puis envoie.
- **Récapitulatif avant chaque envoi** : « 12 convocations vont partir pour Toyota G3, Douala, du 3 au 7 mars ». Puis quelques secondes pour annuler.
- **Doublons et conflits signalés d'office** : stagiaire inscrit deux fois, salle déjà prise, hôtel manquant à J-7.
- **Attestations générées automatiquement** à partir des présences : elle n'a qu'à envoyer.

## Ce qu'Academix montre en plus (19/11/2026)

Source : l'ancienne application Academix, gardée hors dépôt (dossier `Documents\academy`, `docs/ROLES_FEATURES.md`, routes `backend/app/api/v1/`, menu `components/TopHeader.tsx`). Le menu d'Academix ne lui montrait pas les besoins des filiales, seulement « Apprenants », ce qui confirme la décision 4.

Ce qu'elle y faisait, absent du cadrage jusqu'ici :
1. **Fichier des stagiaires** : créer, corriger, supprimer, y compris plusieurs à la fois (`apprenants.py`).
2. **Liste des stagiaires d'une session** : l'importer depuis Excel à partir d'un modèle téléchargeable, ajouter un stagiaire, en corriger un, remplacer toute la liste (`participants.py`, `imports.py:531`).
3. **Remplacer un stagiaire qui se désiste**.
4. **Modifier une session** (dates, lieu, formateur), sans pouvoir la supprimer (`formations.py:441`).
5. **Prévenir les stagiaires d'un changement** : session annulée, formateur ou lieu changé. Plus des rappels automatiques à J-7 et J-1 (`EMAIL_NOTIFICATION_PLAN.md`).

Academix avait annoncé sans les construire les feuilles de présence, les convocations et les attestations en PDF, ainsi que le coût de la logistique (`SYSTEM_OVERVIEW.md` §2). Ce sont déjà nos manques F07 et F14.

**Ce que ça change dans la version simplifiée :**
- « Activité quotidienne » gagne deux tuiles : **Désistements à remplacer** et **Changements à annoncer aux stagiaires** (session annulée, formateur ou lieu changé).
- La liste à cocher de « Mes sessions » : les inscrits s'importent depuis Excel, avec un modèle fourni et un contrôle des doublons avant l'import.
- « À consulter » devient **« Outils »** : fichier des stagiaires, calendrier annuel, clé de répartition.

## Wording en cours de validation (19/11/2026, 2e retour)

Retours de l'utilisateur : « Conflits de salles » devient **Gestion des salles**. Les désistements n'ont pas besoin d'une tuile à eux. « Mes sessions » ne veut rien dire. La logistique n'avait pas d'endroit à elle.

Proposition :
1. **Chaque jour · Activité quotidienne**. Six tuiles, chacune avec une pastille rouge quand il y a du nouveau :
   - Demandes d'assistance ;
   - Inscriptions et convocations : inscrire, remplacer un désistement, envoyer les convocations ;
   - Logistique des stagiaires : vols, hôtel, navettes, visa, coût par stagiaire ;
   - Gestion des salles : réserver, et voir les salles prises deux fois ;
   - Changements à annoncer ;
   - Attestations à envoyer.
2. **Formations à préparer**. Une carte par formation à venir, avec sa liste à cocher. Chaque ligne de la liste ouvre la tuile correspondante. Un onglet « Terminées » regroupe les formations passées.
3. **Outils** : fichier des stagiaires, calendrier de l'année, part de chaque filiale.

## Proposition par moment (19/11/2026, 3e retour, à valider)

Demande de l'utilisateur : ranger les sections par moment : chaque jour, puis avant, pendant et après une formation. Une formation passe d'elle-même d'une section à l'autre selon ses dates. Chaque carte porte une pastille rouge avec un nombre quand une action l'attend.

1. **Chaque jour** : Demandes d'assistance · Fichier des stagiaires.
2. **Avant la formation**, dans l'ordre du travail :
   - Salles à réserver, conflits compris ;
   - Inscriptions, désistements compris ;
   - Voyages et hébergement ;
   - Convocations, changements compris.
3. **Pendant la formation** : Accueil et navettes · Présences du jour (relancer le formateur s'il n'a pas saisi) · Absences et imprévus.
4. **Après la formation** : Attestations à envoyer · Coût final par stagiaire (en lecture, pour la refacturation).
5. **À consulter** : Calendrier de l'année · Part de chaque filiale.

## Proposition par dossier (19/11/2026, 4e retour, à valider)

Retour de l'utilisateur : la version « par moment » est trop éclatée. L'assistante gère 5 dossiers : salles, stagiaires, logistique, invitations, attestations. Le moment (avant, pendant, après) se range dans chaque dossier, et non dans des sections. Proposition :
1. **Demandes d'assistance** : une carte en tête, la seule tâche sans lien avec une formation.
2. **Vos 5 dossiers** : une carte par dossier, dans l'ordre du travail, chacune avec sa pastille rouge :
   - Salles ;
   - Stagiaires ;
   - Logistique ;
   - Invitations ;
   - Attestations.
3. **À consulter** : Calendrier de l'année · Part de chaque filiale.

**Validé par l'utilisateur (19/11)**, avec une réserve : la carte « Demandes des formateurs » (anciennement « Demandes d'assistance ») s'affiche **en construction**, son contenu restant à préciser. Les 5 dossiers n'ont pas encore de données : ils s'affichent aussi en construction, sans fausses données, comme ailleurs dans les portails. La part de chaque filiale existe déjà (clé de répartition, en lecture). Le calendrier existe en partie.

**Modifié (19/11, 5e retour)** : « Demandes des formateurs » est retirée pour l'instant. En tête vient une nouvelle section :

**Prochaines sessions de formation** : les sessions des 2 prochaines semaines. Une fiche par session, avec :
- le logo de la marque et l'intitulé ;
- le formateur ;
- le lieu ;
- les dates ;
- les inscrits sur les places, par exemple « 9 / 12 places » (12 places au maximum).

Un clic ouvre la liste à cocher, où elle voit si la session est complète ou non : salle réservée, stagiaires inscrits, logistique, invitations envoyées. La pastille de la fiche indique « Prête » (vert) ou « 2 choses à faire » (orange).

Ordre final : Prochaines sessions de formation · Vos dossiers (5 cartes) · À consulter. **Validé par l'utilisateur le 19/11.**

## Décisions métier (19/11/2026)

1. **Attestations** : c'est elle qui les prépare et les envoie.
2. **Conflits de salles** : c'est elle qui les arbitre.
3. **Refacturation aux filiales** : elle la consulte ; le coordinateur et le directeur la modifient.
4. **Fiches besoins des filiales** : leur relecture (contrôler, valider, renvoyer pour correction) est le travail du **coordinateur**, pas le sien. Elles sortent de son portail. Le coordinateur aura lui aussi une section « Tâches quotidiennes », sur le même patron (cfao-planning prévenu). Les sections et le tableau MEDACAP plus haut (étape Définir) datent d'avant cette décision.

## Reste à faire côté technique

- **Droits manquants** : Cerbos ne lui donne rien sur les sessions, les inscriptions ni les tickets. Le rôle `planning_manager` de `SPEC_PLANNING_FORMATEURS.md:72` n'existe pas dans les politiques. Ces droits seront à créer en même temps que les écrans.
- **Droits en trop** : Cerbos lui donne validate, reopen, approve et send sur les fiches besoins (`needs_submission`, `needs_outbound`). D'après la décision 4, ces droits reviennent au coordinateur. À revoir avec l'utilisateur avant de les retirer.
