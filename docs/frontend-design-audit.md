# Analyse Stylistique & Architecture Design Frontend · CFAO Academy

Ce document dresse un état des lieux complet du design, de l'ergonomie, des tokens et des composants d'interface du dossier [`/frontend`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src) de l'application **CFAO Academy**.

---

## 1. Identité Visuelle Globale & Design System

Le design combine l'**univers industriel / automobile** (constructeurs, ateliers, outillage) et une **esthétique éditoriale premium** orientée performance et formation continue.

### 1.1 Palette Chromatique & Tokens

| Rôle | Token / Valeur | Utilisation |
| :--- | :--- | :--- |
| **Rouge Marque CFAO** | `--red: #E3001B` / `--red-deep: #B40015` | Boutons d'action principaux, badges d'accent, focus, emphase typographique |
| **Rouge Pastel** | `--red-soft: #FFE5E8` | Fonds d'alerte, puces actives, halos d'emphase |
| **Encre & Marine** | `--navy: #1A1F3C` / `--navy-2: #2A3157` / `--ink: #0E1126` | Titres, arrière-plans de cockpits sombres (StickyBar), typographies principales |
| **Fonds & Papiers** | `--paper: #FFFFFF` / `--paper-2: #FAFAFA` / `--paper-3: #F5F5F5` | Cartes, conteneurs, fond global de page aéré |
| **Ivoire Atelier** | `--paper-ivory: #E8D5B0` | Accents subtils et fonds techniques |
| **Paliers PIF / DPS** | Vert (`#10b981`), Ambre (`#f59e0b`), Indigo/Rouge (`#6366f1` / `#e3001b`) | Niveaux de compétences : *Maintenance (Junior)*, *Réparation (Senior)*, *Diagnostic (Expert)* |

### 1.2 Typographie Tripartite

```
┌─────────────────────────────────────────────────────────────┐
│ Space Grotesk  : Titres d'impact (h1-h3), Grands KPI        │
│ DM Sans        : Corps de texte, lisibilité, UI courante    │
│ JetBrains Mono : Codes (ex: MOT-DIAG-01), Dates, Jauges %   │
└─────────────────────────────────────────────────────────────┘
```

* **Space Grotesk** : Donne une signature contemporaine, technique et percutante.
* **DM Sans** : Assure une lecture fluide et sans fatigue sur de longs descriptifs de cours ou d'articles.
* **JetBrains Mono** : Utilisé pour tous les éléments techniques, compteurs, dates et métadonnées d'ateliers.

### 1.3 Matière, Glassmorphism & Micro-animations

* **Glassmorphism** : La barre de navigation (`Nav.jsx`) et les barres contextuelles (`PortalStickyBar.jsx`) utilisent `backdrop-filter: blur(14px) saturate(180%)`.
* **Halo de curseur** : Présence d'un composant `#cursor-glow` qui suit discrètement le pointeur de l'utilisateur pour animer la surface.
* **Élévations & Courbures** : Rayons réguliers (`border-radius: 12px`, `16px`, `20px`) avec des ombres diffuses `0 2px 12px rgba(14,17,38,0.06)` accentuées au survol (`translateY(-2px)` / `translateY(-4px)`).

---

## 2. Landing Page (`/` · [`Accueil.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/pages/Accueil.jsx))

### 2.1 Hero Section Vivante & Multi-Personas ([`HomeHero.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/HomeHero.jsx))

* **Commutateur de Personas** : Onglets interactifs (*Véhicules Légers*, *Poids Lourds*, *Carrosserie*, *SAV & Pièces*, *B2B*) avec icônes vectorielles personnalisées.
* **Titrage Dynamique Synchronisé** : Les accroches textuelles s'animent en boucle (`headlineHighlight`) en accord avec les photos d'arrière-plan haute définition.
* **Adaptabilité Connecté vs Invité** :
  * En mode invité : expérience immersive avec fond photographique fixe et transitions d'ateliers.
  * En mode connecté : affichage direct du widget d'accueil apprenant/manager ([`HeroLoggedInPanel.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/HeroLoggedInPanel.jsx)).

### 2.2 Système de Sections en Filigrane ([`PreviewSection.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/PreviewSection.jsx))

* **Watermarks Typographiques Géants** : Présence de mots-clés estompés en arrière-plan latéral (*"news"*, *"motors"*, *"equipment"*, *"carrosserie"*, *"2026"*, *"terrain"*).
* **En-têtes Standardisés** :
  * Numérotation en indice (`02 · ACTUALITÉS`, `04 · FORMATIONS MOTORS`...).
  * Titre avec emphase rouge stylisée (`sectionTitle`).
  * Système d'onglets à pastilles avec compteurs dynamiques.
  * Bouton d'expansion progressif (*Voir plus / Voir moins* avec affichage plafonné jusqu'à 12 cartes).

### 2.3 Éléments de Preuve Sociale & Partenariats

* **Marquees Défilants** :
  * [`LogoMarquee.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/LogoMarquee.jsx) : Défilement continu des marques officielles (Toyota, Suzuki, Yamaha, Hino, Mercedes-Benz, JCB, etc.).
  * [`FlagMarquee.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/FlagMarquee.jsx) : Drapeaux des pays du réseau panafricain.
* **Témoignages du Terrain** ([`TestimonialShowcase.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/TestimonialShowcase.jsx)) : Citations et profils concrets d'apprenants et formateurs.

---

## 3. Fiches de Détail Formations ([`FormationFiche.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/pages/FormationFiche.jsx))

### 3.1 Structure "Document Technique / Feuille Magazine"

* Conteneur épuré `article-sheet` centré avec ombre portée douce et bouton de fermeture flottant ([`PageCloseButton.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/PageCloseButton.jsx)).
* Image haute résolution du programme pédagogique ou aperçu PDF pleine page.

### 3.2 Double Badge de Marque & Métadonnées Granulaires

* **En-tête Co-brandé** ([`DetailHeaderLogos.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/DetailHeaderLogos.jsx)) :
  * Logo CFAO Academy + Logo constructeur partenaire côte à côte.
* **Pills de Métadonnées SVG** :
  * **Code Module** (ex: `MTR-2026-08`) avec icône tag.
  * **Calendrier & Durée** (ex: `3 jours`, `14 - 16 Avril 2026`).
  * **Modalité & Localisation** : Badge *Présentiel* (avec drapeau CDN du pays) ou *Distanciel*.
* **Chips de Contexte & Formateur** :
  * Public cible et niveau d'expérience requis.
  * Badge formateur avec avatar et qualification ([`FormateurDisplay.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/FormateurDisplay.jsx)).

### 3.3 Préservation de Contexte de Navigation

* Utilisation de l'utilitaire [`sessionsReturn.js`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/utils/sessionsReturn.js) permettant, lors de la fermeture de la fiche, de restaurer exactement la position du scroll, la section et l'onglet actif sur la page d'accueil.

---

## 4. Pages Articles & Actualités ([`Article.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/pages/Article.jsx))

### 4.1 Traitement Éditorial Immersif

* **Hero Multimédia** ([`ArticleHeroVideo.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/ArticleHeroVideo.jsx)) :
  * Lecteur vidéo autonome haute performance avec poster dynamique, capture de frame et fallback image grand angle.
* **Hiérarchie Éditoriale** :
  * Tag de catégorie thématique coloré (`news-tag--terrain`, `news-tag--innovation`, etc.).
  * Métadonnées d'article : Temps de lecture estimé (`readTime`), date formatée, marque liée.
  * Chapeau d'article typographié en grand corps (`article-lead`) pour accrocher le lecteur.

### 4.2 Composants Riches dans le Corps de l'Article

* **Points Clés / Callouts** ([`ArticleHighlights.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/ArticleHighlights.jsx)) : Encadrés d'impact visuel pour résumer les enseignements majeurs.
* **Grille des Intervenants** ([`ArticleCastGrid.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/ArticleCastGrid.jsx)) : Mise en avant nominative des acteurs et formateurs impliqués.
* **Galeries & Intégrations** : Carrousels photos et vidéos d'ateliers intégrés.
* **Articles Recommandés** : Carrousel inférieur filtrable par BU pour prolonger la lecture.

---

## 5. Le Portail DPS & Cockpit Métier ([`DpsDashboard.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/pages/portal/DpsDashboard.jsx) & [`portal.css`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/styles/portal.css))

Le portail DPS (*Directeur / Responsable Pièces & Service*) constitue un cockpit opérationnel dense, orienté pilotage des équipes techniques et des compétences de filiale.

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PortalStickyBar : Contexte filiale, marques, KPIs, certs │
├─────────────────────────────────────────────────────────────┤
│ 2. PortalHeader    : Salutation, métriques globales filiale │
├─────────────────────────────────────────────────────────────┤
│ 3. Compétences     : Grille par Marque (Scores & Paliers)   │
├─────────────────────────────────────────────────────────────┤
│ 4. PIF Filiale     : Techniciens par Palier (Maint/Rép/Diag)│
├─────────────────────────────────────────────────────────────┤
│ 5. Assistance      : Support dédié, tickets & contacts      │
└─────────────────────────────────────────────────────────────┘
```

### 5.1 Barre de Contexte Supérieure ([`PortalStickyBar.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/PortalStickyBar.jsx))

* Apparaît au scroll sous la barre de navigation.
* Rappelle l'avatar, la filiale, les logos des marques gérées, les certifications acquises et la jauge de progression globale.

### 5.2 Section Résultats des Compétences ([`DpsCollaboratorResultsSection.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/DpsCollaboratorResultsSection.jsx))

* **Cartes par Marque** ([`PlanEntryCard.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/PlanEntryCard.jsx)) :
  * Logo de la marque constructeur.
  * Score moyen d'évaluation avec accentuation chromatique dynamique (`evalScoreAccentColor`).
  * Ratio des techniciens évalués vs effectif global.
* **Navigation avec Morphing** : Enregistrement du rectangle d'origine de la carte (`originRect`) pour une transition fluide vers la vue détaillée marque ([`DpsBrandCompetencyDetailView.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/DpsBrandCompetencyDetailView.jsx)).

### 5.3 Section PIF Filiale ([`DpsFilialePifSection.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/DpsFilialePifSection.jsx))

* **Regroupement par Paliers Métier** :
  1. **Maintenance (Junior)** — code vert
  2. **Réparation (Senior)** — code ambre
  3. **Diagnostic (Expert)** — code indigo/rouge
* **Cartes Techniciens Dédiées** :
  * Avatar / icône technicien stylisée.
  * Agence d'affectation.
  * Puces des marques couvertes.
  * Nombre de formations PIF programmées.

### 5.4 Vues Détaillées & Intégration MEDACAP ([`DpsTechnicianPifDetailView.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/pages/portal/DpsTechnicianPifDetailView.jsx))

* Filtres multi-critères (Marque, Niveau, Périmètre, Volume).
* Stack de KPI et graphiques d'évolution des mesures de compétences.

### 5.5 Section Assistance & Support ([`DpsAssistanceSection.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/DpsAssistanceSection.jsx))

* Suivi des tickets filiale avec puces d'état (*En cours*, *Résolu*).
* Cartes des contacts support et canaux directs.

---

## 6. Synthèse des Points Forts

1. **Unité et Cohérence** : Partage rigoureux des mêmes tokens entre l'espace public (vitrine) et les espaces privés (dashboards).
2. **Finitions UX & Micro-interactions** : États de chargement avec squelettes animés ([`PortalSectionSkeleton.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/PortalSectionSkeleton.jsx)), animations en cascade ([`PortalStaggerGrid.jsx`](file:///c:/Users/jakaa/Downloads/cfaoacademy/frontend/src/components/PortalStaggerGrid.jsx)) et transitions de pages soignées.
3. **Précision Métier & Géographique** : Gestion native du multilingue (FR / EN / PT), intégration des drapeaux nationaux et adaptation aux spécificités des filiales africaines de CFAO.
