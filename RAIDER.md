# RAIDER Engineering Standard

> Copie du standard canonique (`RAIDER.md` du dépôt Project Registry). Ne pas la modifier ici : les évolutions se proposent dans le dépôt source, puis cette copie est resynchronisée.
> Mémoire d'erreurs de ce projet : [docs/engineering/lessons-learned.md](docs/engineering/lessons-learned.md).

RAIDER est le standard d'ingénierie transversal utilisé pour les automatisations, composants partagés, outils de plateforme et évolutions structurantes des projets enregistrés dans le Project Registry.

Son objectif est simple : éviter les solutions jetables qui fonctionnent une fois sur un seul dépôt, puis deviennent fragiles dès qu'on les réutilise, qu'on les relance ou qu'on les applique à un projet existant.

## R — Reusable

Une capacité doit être conçue pour être réutilisée sans copier-coller ni fork spécifique au consumer.

Concrètement :
- privilégier les modules, presets, contrats et workflows réutilisables ;
- isoler la logique générique de la configuration propre à un produit ;
- injecter le contexte et les dépendances au lieu de les coder en dur ;
- documenter les interfaces publiques et leurs responsabilités ;
- éviter les branches de code du type `if repo === ...` lorsqu'une abstraction ou une configuration suffit.

## A — Agnostic

Le comportement ne doit pas dépendre implicitement d'un dépôt, d'un owner, d'une branche, d'une stack, d'un OS, d'un workflow ou d'un fournisseur particulier lorsque ce contexte peut être découvert ou configuré.

Concrètement :
- découvrir la branche par défaut au lieu de supposer `main` ;
- résoudre les identifiants dynamiquement lorsque la plateforme le permet ;
- séparer le core métier des adaptateurs GitHub, Cloudflare, Windows, etc. ;
- rendre les noms de checks, phases, projets et ressources déclaratifs ;
- tester plusieurs contextes représentatifs.

## I — Idempotent

Relancer une automatisation avec le même état désiré doit produire le même état final, sans doublons ni écritures inutiles.

Le modèle attendu est :

```text
inspect current state
        ↓
compute desired state
        ↓
compare
   ┌────┴────┐
 no drift   drift
   ↓          ↓
 no-op     minimal reconcile
```

Concrètement :
- lire l'état courant avant d'écrire ;
- créer uniquement ce qui manque ;
- mettre à jour uniquement ce qui dérive ;
- rendre les retries sûrs ;
- tester explicitement qu'un second `apply` produit zéro écriture lorsque l'état est convergé.

## D — Durable / Non-regressive

Une nouvelle capacité doit préserver les comportements et contrats déjà supportés, sauf changement incompatible intentionnel, versionné et documenté.

Concrètement :
- garder les anciennes configurations valides lorsque cela est raisonnablement possible ;
- couvrir les workflows existants par des tests de non-régression ;
- considérer les inputs publics, formats de config et sorties consommées comme des contrats ;
- ne pas déclarer une feature terminée uniquement parce que ses nouveaux tests passent : l'existant doit aussi rester vert ;
- utiliser un changement de version explicite lorsqu'une rupture est réellement nécessaire.

### Failure Memory / Continuous Learning

Une erreur significative n'est pas complètement résolue tant que la leçon n'est pas capturée et que le risque de récidive n'a pas été réduit de manière raisonnable.

Le cycle attendu est :

```text
failure / incident / near miss
            ↓
         record
            ↓
      classify + root cause
            ↓
           fix
            ↓
    prevent recurrence
            ↓
    generalize the lesson
            ↓
new test / guardrail / pattern / sub-principle
```

Sous-principes :
- **Record the failure** — conserver le contexte, le symptôme, l'impact et les conditions de déclenchement utiles ;
- **Find the root cause** — distinguer la cause racine du symptôme et du correctif immédiat ;
- **Classify the lesson** — classer l'événement pour rendre la mémoire consultable, par exemple architecture, sécurité, CI/CD, données, dépendances, infrastructure, release/déploiement, automatisation, UX, performance, tests ou process ;
- **Prevent recurrence** — lorsqu'une prévention raisonnable existe, ajouter un test, une validation, un guardrail, une règle CI, une amélioration d'architecture, une checklist ou une documentation actionnable ;
- **Generalize when possible** — si l'erreur révèle un angle mort plus large, transformer la leçon en pattern, sous-principe RAIDER, convention, ADR ou règle applicable à d'autres projets ;
- **Search the memory before repeating risky work** — consulter les leçons existantes avant une évolution proche d'un incident déjà rencontré ;
- **Near misses count** — un incident évité de justesse peut révéler le même angle mort qu'un échec réel et mérite d'être capturé lorsqu'il apporte une leçon réutilisable.

Une correction sans mécanisme de prévention est considérée comme incomplète lorsqu'un mécanisme raisonnable, proportionné et vérifiable peut être ajouté.

Chaque projet appliquant RAIDER doit maintenir une mémoire consultable de ses leçons significatives. Le chemin par défaut est `docs/engineering/lessons-learned.md`; un emplacement équivalent reste valide s'il est explicite et facilement découvrable.

Une erreur répétée après avoir été documentée signifie que la prévention précédente était insuffisante : le niveau de contrôle doit être renforcé plutôt que simplement réappliquer le même correctif.

## E — Engineering-grade

L'implémentation doit suivre des patterns professionnels adaptés au problème, pas simplement « fonctionner ».

### Change-scoped execution / pipelines proportionnels

Le rayon d'exécution d'une automatisation doit être proportionnel au rayon d'impact réel du changement. Un pipeline ne doit construire, tester, auditer, versionner ou déployer que les surfaces que le changement peut raisonnablement affecter.

Le modèle attendu est :

```text
changed files / configuration
          ↓
    impacted surfaces
          ↓
     required gates
          ↓
affected builds / tests / deploys / releases only
```

Un changement sans impact sur une surface doit produire un **no-op** pour cette surface.

Concrètement :
- découper les workflows par surface produit lorsque les responsabilités sont distinctes : site public, application, backend, sécurité, infrastructure, release, etc. ;
- utiliser des filtres de chemins, une matrice d'impact ou un graphe de dépendances lorsque cela permet de déterminer correctement les surfaces affectées ;
- ne pas déclencher un build natif, une suite de tests lourde, un audit sécurité spécifique ou un déploiement sans relation avec les fichiers modifiés ;
- ne pas déclencher de versioning ou de release d'un artefact lorsqu'un changement ne touche pas cet artefact ni son contrat de release ;
- traiter explicitement les fichiers transversaux — dépendances partagées, configuration de build, workflows, manifests de release — comme des causes légitimes de fan-out vers plusieurs surfaces ;
- conserver un chemin manuel ou complet lorsque la validation globale est réellement nécessaire ;
- tester les règles de déclenchement elles-mêmes, car un mauvais filtre peut autant gaspiller des ressources qu'ignorer une validation nécessaire.

**Anti-pattern explicite :**

```text
favicon / copy / landing-only change
          ↓
full application CI
+ native build
+ unrelated security suite
+ release/version bump
```

**Proof of Done minimal :**
- un changement limité à une surface ne réveille pas les pipelines sans rapport ;
- un changement transversal déclenche toutes les surfaces réellement dépendantes ;
- les changements de configuration de release continuent à déclencher la release ;
- les changements de configuration d'un workflow déclenchent ou valident ce workflow de façon appropriée ;
- une validation manuelle complète reste disponible lorsqu'elle est utile.

Cette règle a été formalisée après un incident observé sur **Trigenys/sims-mod-health** : une correction de favicon du site public a révélé que de simples pushes sur `main` pouvaient réveiller Full CI, Security CI et Product release, donc reconstruire/tester des composants desktop et backend sans rapport avec le site. La correction locale a conduit à généraliser la règle dans RAIDER plutôt que de laisser la leçon enfermée dans un seul dépôt.

### Reuse-first / ecosystem reconnaissance

Avant de construire une capacité non triviale, rechercher activement ce qui existe déjà et peut être adopté, adapté ou étudié. Cette reconnaissance fait partie du travail par défaut : elle ne doit pas attendre une demande explicite.

Le réflexe attendu est :

```text
besoin identifié
      ↓
recherche de l'écosystème
GitHub / OSS / packages / Actions / standards / patterns éprouvés
      ↓
évaluation
maintenance · licence · sécurité · tests · compatibilité · coût d'intégration
      ↓
décision
Adopt · Adapt · Learn · Build
```

Construire from scratch reste valide lorsqu'aucune option existante n'est suffisamment sûre, maintenue, compatible ou adaptée au besoin. La décision doit alors être consciente et justifiable, pas simplement résulter du fait que la recherche n'a pas été faite.

Principes attendus :
- rechercher proactivement les repositories, bibliothèques, actions, standards et patterns pertinents avant une implémentation significative ;
- privilégier **Adopt** lorsqu'une solution existante couvre correctement le besoin ;
- **Adapt** lorsqu'une intégration ou extension propre apporte la valeur manquante ;
- **Learn** lorsqu'un projet existant fournit des patterns utiles sans être directement intégrable ;
- **Build** lorsque construire apporte une valeur réelle que les options existantes ne fournissent pas ;
- séparation des responsabilités ;
- configuration déclarative ;
- principe du moindre privilège ;
- contrats explicites ;
- logique déterministe et testable ;
- erreurs actionnables ;
- secrets non journalisés ;
- compatibilité et migration pensées dès la conception ;
- versioning des interfaces publiques ;
- observabilité proportionnée au risque ;
- préférence pour `plan → review → apply` quand une automation modifie de l'état distant important.

## R — Retroactive

Une évolution doit pouvoir être adoptée par un projet déjà existant sans exiger de repartir de zéro.

Concrètement :
- traiter les dépôts existants comme un cas de première classe ;
- inspecter les règles, données et ressources déjà présentes ;
- préserver l'état non géré par l'automation ;
- réconcilier uniquement les ressources explicitement possédées par le système ;
- documenter les conflits qui ne peuvent pas être résolus automatiquement ;
- tester les scénarios brownfield en plus des scénarios greenfield.

## Definition of Done RAIDER

Avant de considérer une capability terminée, vérifier :

- [ ] **Reusable** — elle fonctionne pour plusieurs consumers sans fork ni logique spécifique cachée ;
- [ ] **Agnostic** — les identités, branches, stacks et conventions variables viennent du runtime ou de la configuration ;
- [ ] **Idempotent** — après convergence, une nouvelle exécution est un no-op ;
- [ ] **Durable** — les comportements existants et contrats supportés restent verts ;
- [ ] **Failure memory** — toute erreur ou near miss significatif rencontré pendant le travail a une leçon capturée, une cause comprise et une prévention proportionnée lorsque possible ;
- [ ] **Engineering-grade** — architecture, sécurité, tests, erreurs et documentation sont au niveau attendu ;
- [ ] **Scoped execution** — les pipelines, builds, audits, déploiements et releases déclenchés sont proportionnels aux surfaces réellement affectées ;
- [ ] **Reuse-first** — pour une évolution non triviale, l'écosystème pertinent a été recherché et la décision Adopt / Adapt / Learn / Build est justifiable ;
- [ ] **Retroactive** — un projet existant peut adopter la capability sans reset destructif ;
- [ ] les exceptions sont documentées explicitement avec leur justification et leur impact.

## Anti-patterns RAIDER

Quelques signaux d'alerte :
- corriger une erreur significative sans capturer la cause, la leçon et une prévention raisonnable ;
- rencontrer plusieurs fois le même problème sans renforcer le guardrail qui devait empêcher sa récidive ;
- laisser une leçon locale alors qu'elle révèle clairement un angle mort générique applicable à d'autres projets ;
- commencer à implémenter une brique non triviale sans rechercher les solutions, repositories ou patterns existants ;
- réimplémenter une capacité mature sans avantage clair ni justification ;
- un nom de dépôt, owner ou branche codé en dur sans nécessité ;
- une automation qui recrée une ressource à chaque run ;
- une feature nécessitant de supprimer l'existant avant de fonctionner ;
- une solution copiée dans plusieurs repos au lieu d'être extraite ;
- un token beaucoup plus privilégié que nécessaire ;
- une nouvelle feature dont seuls les nouveaux tests passent alors que l'ancien comportement n'est plus vérifié ;
- un changement limité à une surface qui déclenche des builds, audits, déploiements ou releases sans rapport ;
- un pipeline global branché sur chaque push alors que des frontières de produit permettent un déclenchement plus précis ;
- une logique de transport/API mélangée à la policy métier au point de rendre le core impossible à tester seul.

## Usage

RAIDER est un critère de conception, de revue et de validation. Pour les évolutions importantes :

1. consulter les leçons connues pertinentes et rechercher l'écosystème utile ;
2. identifier les options Adopt / Adapt / Learn / Build ;
3. définir l'état désiré et les contrats ;
4. identifier les risques RAIDER avant l'implémentation ;
5. couvrir les garanties mécaniquement testables ;
6. lorsqu'une erreur ou un near miss significatif survient, capturer la cause, la résolution, la prévention et la leçon généralisable ;
7. si la leçon révèle un angle mort, proposer ou mettre à jour le test, guardrail, pattern, checklist, ADR ou sous-principe correspondant ;
8. valider sur au moins un vrai consumer ;
9. lorsque la réutilisabilité est un objectif central, valider ensuite sur un second consumer différent.

Toute exception à RAIDER doit être intentionnelle, limitée et documentée dans l'issue, l'ADR ou la pull request concernée.
