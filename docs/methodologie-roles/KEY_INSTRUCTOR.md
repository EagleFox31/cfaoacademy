# Dossier de Référence Métier : Le Rôle de Key Instructor (KI)

> **Document de référence pour la conception métier, l'architecture des droits (Cerbos) et l'expérience utilisateur (Portail App 03).**  
> Complète [`PLATFORM_ROLES.md`](../../PLATFORM_ROLES.md), [`PLATFORM_APPS.md`](../../PLATFORM_APPS.md), [`docs/medacap-competency-model.md`](../medacap-competency-model.md) et [`docs/portal-ki-andre-yogba-plan.md`](../portal-ki-andre-yogba-plan.md).

---

## 1. Fondements, Définition & Origines du Rôle

### 1.1 Genèse Industrielle et Contexte Automobile
Le concept de **Key Instructor** (ou *Formateur Relais / Tuteur Référent d'Atelier*) est issu des meilleures pratiques des constructeurs automobiles mondiaux — en particulier **Toyota Motor Corporation (TMC) et Toyota Tsusho**, complétées par les standards de Stellantis, Renault Trucks, Hino, Caterpillar et Volvo.

Face à des réseaux de distribution géographiquement très dispersés (comme le réseau panafricain de **CFAO Mobility**, présent dans plus de 30 pays), les constructeurs ont formalisé le modèle de la **formation en cascade (*Train-the-Trainer / T3*)**.

```
             ┌────────────────────────────────────────────────────────┐
             │       CONSTRUCTEUR (OEM) & CENTRE ACADEMY CENTRAL      │
             │   Ingénieurs Pédagogiques · Master Trainers Constructeur│
             │   (Pôle Formation Régional, ex. CFAO Academy Douala)   │
             └───────────────────────────┬────────────────────────────┘
                                         │  Accréditation et certification
                                         │  de niveau G1 / Master Diagnostic
                                         ▼
             ┌────────────────────────────────────────────────────────┐
             │              KEY INSTRUCTORS (KI / PIC)                │
             │     Techniciens Experts d'Atelier en Filiale Locale    │
             │     (André YOGBA et les 17 KI du réseau CFAO)          │
             └───────────────────────────┬────────────────────────────┘
                                         │  Transmission au poste (OJT / TWI)
                                         │  Dojo d'atelier · Évaluations terrain
                                         ▼
             ┌────────────────────────────────────────────────────────┐
             │           TECHNICIENS & APPRENANTS D'AGENCE            │
             │   Paliers G4 / Maintenance (Junior) · G3 / Réparation (Senior)│
             └────────────────────────────────────────────────────────┘
```

### 1.2 Pourquoi ce rôle est indispensable dans le réseau CFAO
1. **Élimination de la rupture de charge géographique :** Il est économiquement et logistiquement impossible d'envoyer chaque technicien junior ou apprenti en avion vers les centres régionaux (Douala, Abidjan) pour des modules de base (freinage, métrologie, climatisation, vidange, circuit de charge).
2. **Réactivité face aux évolutions technologiques :** Lors du lancement d'un nouveau véhicule, d'une motorisation hybride/électrique ou d'un bulletin de service urgent (TSB), le KI est formé en priorité par le *Trainer* de l'Academy et répercute la méthode dans ses ateliers dès le lendemain matin.
3. **Ancrage dans la réalité du terrain :** La formation par les pairs (*peer learning*) est la méthode pédagogique affichant le plus fort taux de rétention de savoir dans les métiers manuels et mécatroniques.

---

## 2. Le Modèle de la « Double Casquette » (*Dual-Hat*)

La spécificité architecturale et organisationnelle du Key Instructor réside dans sa **double posture opérationnelle**. Il ne s'agit pas d'un formateur de bureau détaché du travail réel, mais d'un **technicien d'élite productif qui consacre une partie de son temps à la transmission et à l'évaluation**.

```
                           ┌───────────────────────────────────┐
                           │      KEY INSTRUCTOR (KI / PIC)    │
                           └─────────────────┬─────────────────┘
                                             │
             ┌───────────────────────────────┴───────────────────────────────┐
             ▼                                                               ▼
┌───────────────────────────────────────────┐   ┌───────────────────────────────────────────┐
│     CASQUETTE 1 : PRATICIEN / APPRENANT   │   │     CASQUETTE 2 : FORMATEUR SUPPLÉANT     │
│             (Rôle : `learner`)            │   │              (Rôle : `ki`)                │
├───────────────────────────────────────────┤   ├───────────────────────────────────────────┤
│ • Technicien en atelier (70-80% du temps) │   │ • Formateur suppléant interne filiale     │
│ • Prise en charge des diagnostics lourds  │   │ • Animation de sessions pratiques locales │
│ • Soumis aux mesures de compétences       │   │ • Mentorat et transmission au poste (OJT) │
│ • Porteur d'un PIF (visée grade supérieur)│   │ • Évaluation et validation des gestes     │
│ • Accès à son Espace Apprenant (App 02)   │   │ • Accès à son Espace KI/PIC (App 03)      │
└───────────────────────────────────────────┘   └───────────────────────────────────────────┘
```

### Casquette 1 : L'Apprenant-Praticien (`learner`)
Le KI reste soumis à l'évaluation permanente. Même certifié **Diagnostic (G2)** ou **Master (G1)** sur sa marque, il continue d'apprendre :
* Il suit son **Plan Individuel de Formation (PIF)**.
* Il passe les évaluations de compétences théoriques et pratiques de son propre niveau.
* Il consulte ses certifications et attestations sur son espace personnel.

### Casquette 2 : L'Instructeur et Évaluateur Relais (`ki`)
Sur le terrain, il agit comme le tuteur accrédité de sa marque pour sa filiale :
* Il encadre les techniciens de niveaux inférieurs qui lui sont assignés.
* Il dispense des **Formations à Dispenser (FAD)** dérivées de son niveau d'habilitation.
* Il valide les épreuves pratiques en atelier (compétences déclaratives).
* Il assure le rôle de premier niveau d'escalade diagnostic lors des pannes complexes.

---

## 3. Normes Internationales, Standards & Méthodologies

### 3.1 Standards Constructeurs : Paliers de Certification
Dans le réseau CFAO Motors & Equipment, les compétences s'articulent autour d'une échelle à 4 paliers standardisés :

| Palier Constructeur | Dénomination Toyota / Standard | Niveau MEDACAP | Activités Clés en Atelier | Habilitation Pédagogique du KI |
|---|---|---|---|---|
| **G4** | *Technician* | **Junior** (Maintenance) | Entretien périodique, vidange, pneumatiques, freinage standard, contrôles visuels de sécurité. | Formé par les KI G3, G2, G1 |
| **G3** | *Pro-Technician* | **Senior** (Réparation) | Dépose/repose d'organes, distribution, révision boîte/pont, climatisation, électricité de base. | Formé par les KI G2, G1 |
| **G2** | *Diagnostic Technician* | **Expert** (Diagnostic) | Recherche de pannes complexes, multiplexage (CAN/LIN), gestion moteur, systèmes d'injection, hybride. | Formé par les KI G1 ou Trainers |
| **G1** | *Master Diagnostic Tech.* | **Master** (Expertise) | Expertise globale, interventions haute tension (EV), acoustique/vibrations, support réseau. | Formé par l'Academy / OEM |

### 3.2 Méthodes Pédagogiques d'Atelier
Le Key Instructor applique des méthodes industrielles éprouvées :

1. **Training Within Industry (TWI) — Module *Job Instruction* (JI) :**
   Standard international en 4 étapes pour la transmission d'un geste professionnel :
   * *Étape 1 : Préparer l'apprenant* (le rassurer, définir l'objectif, vérifier ses prérequis).
   * *Étape 2 : Présenter l'opération* (expliquer, montrer, faire ressortir les points clés de sécurité et de qualité).
   * *Étape 3 : Faire exécuter par l'apprenant* (l'apprenant effectue la tâche, commente ses gestes, le KI corrige immédiatement toute déviation).
   * *Étape 4 : Suivre en situation réelle* (autonomisation progressive, désignation d'un canal d'aide).

2. **Le Dojo d'Atelier (*Shopfloor Training Dojo*) :**
   Espace dédié dans l'atelier (ou sur une baie d'apprentissage) où le KI fait pratiquer les techniciens hors de la pression directe de facturation client sur des bancs de test ou maquettes didactiques (freinage, connectique, calage distribution).

3. **Le Standard *Fix It Right (FIR)* du Toyota Service Management (TSM) :**
   Le KI est le garant de la qualité : il s'assure que les réparations respectent scrupuleusement la documentation technique constructeur pour atteindre un taux de résolution de 100 % dès la première visite.

### 3.3 Articulation avec le Modèle de Compétences MEDACAP
Le modèle de compétences **MEDACAP** déployé chez CFAO distingue deux modalités d'évaluation :
* **Modalité Factuelle (`modality: theory`) :** QCM e-learning portant sur la compréhension des systèmes et principes physiques (passé par l'apprenant en autonomie sur l'App 02).
* **Modalité Déclarative / Pratique (`modality: practical`) :** Évaluation des compétences observables en situation de travail. **Cette modalité nécessite obligatoirement l'observation et la validation formelle par le Key Instructor sur l'App 03.**

---

## 4. Matrice des Frontières et Règle d'Habilitation d'Enseignement

### 4.1 Différenciation des Rôles Clés

| Dimension | **Trainer (Formateur Academy)** | **Key Instructor (KI)** | **Partner Instructor (PIC)** | **Chef d'Atelier (Workshop Manager)** |
|---|---|---|---|---|
| **Mission principale** | Former à temps plein | Produire en atelier + former/évaluer en relais | Idem KI, mais dans le réseau partenaire | Gérer la rentabilité, l'équipe et les plannings |
| **Rattachement** | Centre CFAO Academy (Douala/Régional) | Filiale interne CFAO (ex. CFAO Cameroun) | Partenaire externe / Concession franchisée | Agence locale |
| **Scope Organisationnel** | Flottant (multi-filiales, multi-pays) | **Filiale d'affectation uniquement** | **Réseau partenaire uniquement** | **Agence / Atelier local** |
| **Scope Marque** | Multi-marques ou pôle dédié | **Marque certifiée uniquement** (ex. Toyota) | **Marque certifiée uniquement** | Toutes marques de son atelier |
| **Habilitation pédagogique** | Tous niveaux (G4 $\rightarrow$ G1) | **Niveaux strictement inférieurs au sien** | **Niveaux strictement inférieurs au sien** | Aucune habilitation pédagogique formelle |
| **Lien managérial** | Aucun lien hiérarchique direct | Mentor / Tuteur (pas d'autorité disciplinaire) | Mentor / Tuteur | Supérieur hiérarchique direct |

### 4.2 La Règle Logique d'Habilitation d'Enseignement
Dans les politiques de sécurité **Cerbos**, les droits du Key Instructor sur l'App 03 sont évalués selon la formule suivante :

$$\text{Autorisation KI} = \left( \text{ScopeOrg}_{\text{Apprenant}} \subseteq \text{ScopeOrg}_{\text{KI}} \right) \;\land\; \left( \text{Marque}_{\text{Apprenant}} = \text{Marque}_{\text{KI}} \right) \;\land\; \left( \text{Niveau}_{\text{Apprenant}} < \text{Niveau}_{\text{KI}} \right)$$

* **Conséquence directe :** Un KI certifié Toyota G2 (Diagnostic) en filiale Cameroun :
  * ✅ Peut voir, évaluer et encadrer les techniciens Toyota Cameroun de niveau G4 (Junior) et G3 (Senior).
  * ❌ Ne peut pas évaluer les techniciens Toyota Cameroun de niveau G2 ou G1.
  * ❌ Ne peut pas intervenir sur les techniciens Suzuki, Sinotruk ou Renault Trucks de sa propre filiale.
  * ❌ Ne peut pas évaluer les techniciens de la filiale Côte d'Ivoire.

---

## 5. Valeur Économique et ROI pour le Réseau CFAO

L'activation systématique du réseau de Key Instructors génère un retour sur investissement mesurable :

```
┌────────────────────────────────────────┐     ┌────────────────────────────────────────┐
│        RÉDUCTION DES COÛTS             │     │         EXCELLENCE OPÉRATIONNELLE      │
│ • -60% sur les frais de déplacement    │     │ • Hausse du taux Fix It Right (FIR)    │
│   (billets d'avion, hôtels pour G4/G3) │     │ • Diminution des retours sous garantie │
│ • Réduction du temps improductif       │     │ • Diffusion instantanée des TSB/Rappels│
└────────────────────────────────────────┘     └────────────────────────────────────────┘
                                 ▲             ▲
                                 │             │
                                 └───┬─────────┘
                                     │
                        ┌────────────┴────────────┐
                        │   RÉSEAU KEY INSTRUCTORS│
                        │    (17 KI Panafricains) │
                        └────────────┬────────────┘
                                     │
                                 ┌───┴─────────┐
                                 │             │
                                 ▼             ▼
┌────────────────────────────────────────┐     ┌────────────────────────────────────────┐
│         VALORISATION DU CAPITAL        │     │         MAÎTRISE DES RISQUES           │
│ • Filière d'excellence technique       │     │ • Sécurisation des interventions       │
│ • Rétention des meilleurs profils      │     │   haute tension (Hybride / EV)         │
│ • Reconnaissance du savoir-faire       │     │ • Respect strict des normes constructeur│
└────────────────────────────────────────┘     └────────────────────────────────────────┘
```

---

## 6. Idées Novatrices & Spécifications UX pour le Portail Key Instructor (App 03)

À partir des standards de l'industrie et de la réalité des ateliers, voici **7 innovations majeures** à intégrer dans l'interface et le portail du Key Instructor :

---

### 💡 Innovation 1 : Le Mode « Dojo d'Atelier » & Grille d'Évaluation OJT Tactile
* **Problématique terrain :** Évaluer un technicien les mains sales, au bord du pont élévateur, avec un PC portable est impraticable.
* **Solution UX :** Un **mode tablette/smartphone plein écran** (*Atelier View*) avec boutons surdimensionnés, contraste élevé et saisie simplifiée.
* **Fonctionnalités :**
  * **Chronomètre intégré :** Mesure du temps d'exécution par rapport au temps barémé constructeur.
  * **Checklist TWI à 3 critères :** *1. Sécurité / EPI*, *2. Respect de la procédure technique*, *3. Contrôle qualité / Propreté du poste*.
  * **Point d'arrêt bloquant (*Kill Criteria*) :** Une faute grave de sécurité (ex. absence de chandelle, non-consignation batterie HT) stoppe immédiatement l'évaluation avec mention rouge non négociable.
  * **Signature tactile conjointe :** L'apprenant et le KI signent directement sur l'écran à la fin de l'épreuve.

---

### 💡 Innovation 2 : La Matrice des Compétences Vivante (*Live Workshop Skill Heatmap*)
* **Problématique terrain :** Le KI et le chef d'atelier manquent de visibilité globale sur les compétences disponibles dans l'ensemble des agences de la filiale.
* **Solution UX :** Une **matrice thermique interactive** (vert/jaune/rouge) croisant les techniciens, les domaines fonctionnels (Moteur, Freinage, Électricité, Climatisation, Diagnostic, Hybride) et les marques.
* **Fonctionnalités :**
  * **Détecteur automatique de « déserts techniques » :** Le portail alerte :  
    `⚠️ Alerte Filiale : L'agence de Garoua n'a aucun technicien qualifié sur le diagnostic injection Common Rail.`
  * **Recommandation intelligente de FAD (Formations à Dispenser) :** L'interface suggère automatiquement au KI :  
    `"3 techniciens sont prêts pour le palier G3 Freinage ABS. Planifier un atelier pratique."`

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ MATRICE DES COMPÉTENCES FILIALE — TOYOTA CAMEROUN (Vue KI André YOGBA)                 │
├──────────────────────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│ Technicien           │ Maintenance │ Frein/Liais.│ Électricité │ Diagnostic  │ Hybride │
├──────────────────────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────┤
│ Jean NGASSA (Dla)    │  ✅ 100%    │   ✅ 92%    │   🟨 65%    │   🟥 30%    │  ❌ 0%  │
│ Paul TCHANA (Ydé)    │  ✅ 100%    │   ✅ 88%    │   ✅ 85%    │   🟨 60%    │  🟥 20% │
│ Pierre FOTSO (Bfm)   │  ✅ 95%     │   🟨 55%    │   🟥 25%    │   ❌ 0%     │  ❌ 0%  │
└──────────────────────┴─────────────┴─────────────┴─────────────┴─────────────┴─────────┘
```

---

### 💡 Innovation 3 : Le Module « Flash-Briefing & Diffusion TSB » (*10-Min Toolbox Talk*)
* **Problématique terrain :** Les notes techniques de rappel constructeur (TSB) dorment souvent dans les boîtes mail sans être transmises aux équipes d'exécution.
* **Solution UX :** Un onglet **« Causerie Technique du Matin »** permettant au KI d'animer un briefing flash de 5 à 10 minutes.
* **Fonctionnalités :**
  * Fiche mémo visuelle générée par l'Academy (schéma de la panne récurrente, couple de serrage révisé, référence de l'outil spécialisé).
  * **Émargement éclair par QR Code / Clic rapide :** Le KI coche les présents en 15 secondes. L'historique alimente immédiatement le reporting de conformité qualité de la filiale.

---

### 💡 Innovation 4 : Le Hub d'Escalade Diagnostic & Base de Connaissances Réseau (*Escalation Hub*)
* **Problématique terrain :** Quand un technicien bute sur une panne, le remplacement de pièces à l'aveugle coûte cher et le recours à l'Academy manque de formalisation.
* **Solution UX :** Un **module de guidage diagnostic** structuré pour le KI.
* **Fonctionnalités :**
  * **Arbre de décision méthodique :** Vérification obligatoire des basiques (*Tension batterie $\rightarrow$ Masses $\rightarrow$ Réseau CAN $\rightarrow$ Codes DTC enregistrés*).
  * **Dossier d'escalade normalisé :** Si la panne résiste, le KI génère en 1 clic un ticket d'assistance pré-rempli vers le *Trainer Academy* / *Flying Doctor* avec captures d'écran de l'outil de diagnostic (Techstream, CLIP, etc.) et relevés oscilloscope.
  * **Base de pannes résolues partagée :** Dès qu'un cas complexe est résolu, il est versé dans la base commune accessible aux **17 Key Instructors** du réseau panafricain.

---

### 💡 Innovation 5 : Le Basculeur de Contexte Intelligent (*Smart Context Switcher*)
* **Problématique terrain :** Le KI jongle en permanence entre son apprentissage personnel et ses devoirs de tuteur.
* **Solution UX :** Une barre d'en-tête persistante permettant de basculer instantanément d'un clic entre les deux modes :
  * 🟢 **Mode Praticien :** Affiche mon PIF personnel, mes prochains modules G1, mon avancement e-learning.
  * 🔵 **Mode Instructeur :** Affiche mes 8 techniciens assignés, les 2 validations d'épreuves en attente, mes sessions d'atelier programmées.
  * Pastille de notification différenciée pour chaque mode.

---

### 💡 Innovation 6 : Architecture *Offline-First* pour les Zones Blanches d'Atelier
* **Problématique terrain :** Dans les fosses d'atelier, les baies de lavage ou les agences reculées, la connectivité Wi-Fi / 4G est instable ou inexistante.
* **Solution Technique :**
  * Implémentation d'une **Progressive Web App (PWA)** avec stockage local sécurisé (IndexedDB).
  * Le KI peut réaliser toutes ses évaluations et émargements 100 % hors-ligne.
  * Synchronisation en arrière-plan dès le retour du réseau via un mécanisme d'Outbox fiable.

---

### 💡 Innovation 7 : Générateur d'Ateliers Pratiques & Simulateur de Pannes (*Troubleshooting Scenario Builder*)
* **Problématique terrain :** Les KI manquent parfois de temps pour inventer des exercices pratiques calibrés.
* **Solution UX :** Une **bibliothèque de pannes pédagogiques prêtes à l'emploi** fournie par l'Academy et adaptée au niveau de l'apprenant.
* **Exemple de fiche fournie au KI :**
  * *Titre de l'exercice :* Recherche de fuite de courant parasite sur Toyota Hilux GD-6.
  * *Panne injectée par le KI :* Relais d'accessoire collé ou fusible leurré.
  * *Consigne donnée à l'apprenant :* "Le véhicule décharge sa batterie en 48h, identifiez le consommateur sans débrancher la batterie."
  * *Barème et points de contrôle pré-remplis pour la notation.*

---

## 7. Tableau Récapitulatif des Spécifications Techniques

| Fonctionnalité | Rôle Backend (`cfao-core`) | Règle Cerbos | Composant Frontend (`frontend/`) |
|---|---|---|---|
| **Consultation apprenants assignés** | `GET /api/v1/core/instructor/learners` | `resource.orgPath CONTAINS principal.scopeNode` AND `resource.brand == principal.instructorBrand` | `KiToyotaFilialePifSection.jsx` |
| **Saisie évaluation pratique (OJT)** | `POST /api/v1/core/evaluations/{id}/practical` | `principal.roles.contains("ki")` AND `resource.level < principal.certLevel` | `KiOjtEvaluationModal.jsx` |
| **Grille thermique des compétences** | `GET /api/v1/core/analytics/workshop-heatmap` | Scope filiale + marque certifiée | `WorkshopSkillHeatmap.jsx` |
| **Briefing flash TSB & émargement** | `POST /api/v1/core/briefings/sign` | Scope filiale | `QuickBriefingCard.jsx` |
| **Ticket d'escalade diagnostic** | `POST /api/v1/ops/tickets` (Node service) | `action: "create"` sur ticket technique | `DiagnosticEscalationModal.jsx` |
