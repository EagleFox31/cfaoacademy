# Proposition de Portail Key Instructor : Dossier `KI-Gemini`

> **Ce dossier contient l'implémentation complète et fonctionnelle de la proposition de portail pour le rôle de Key Instructor (KI / PIC), conçue en réutilisant l'ensemble des briques « LEGO » éprouvées sur le portail DPS (Directeur Pièces & Services).**
>
> Accessible en direct via l'URL : **`http://localhost:5173/portail/ki-gemini`** (ou via le bouton *« ✨ Démo KI-Gemini »* dans la barre de démonstration).

---

## 1. Vue d'Ensemble & Architecture « LEGO »

Le portail **KI-Gemini** s'appuie sur le Design System officiel de CFAO Academy et adapte les briques modulaires du portail DPS :

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ NAVBAR (Frosted Glass) · Logo CFAO Academy · Profil André YOGBA · Drapeau Cameroun 🇨🇲   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PORTAL HEADER (Dark Navy #0f172a)                                                      │
│ • Greeting Block : Salutation dynamique, badge Key Instructor, filiale & marque       │
│ • KiHeroCard : Prochaine session à animer (Diagnostic Multiplexage) & lien parcours G1 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ SMART CONTEXT SWITCHER (Double Casquette)                                              │
│ [ 🛠️ Espace Formateur Relais (Actif) ]  /  [ 🎓 Mon Parcours Praticien (G1) ]           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. SECTION BILAN (KPIs d'Atelier)                                                      │
│    3 Sessions FAD  ·  10 Techniciens suivis  ·  8 Évals validées  ·  78% Moyenne      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. SECTION SESSIONS À ANIMER (FAD)                                                     │
│    Cartes FAD avec badges statut, dates, lieux atelier Douala et liste des stagiaires │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. SECTION DOJO D'ATELIER & SKILL HEATMAP                                              │
│    • Matrice thermique dynamique des compétences par domaine et agence                 │
│    • Bouton déclencheur « ⚡ Évaluer OJT » pour chaque technicien                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 4. SECTION RÉSULTATS MARQUE (Réutilisation PlanEntryCard & DpsBrandResultSummary)    │
│    • Carte Toyota officielle avec jauges Junior (92%), Senior (82%), Expert (60%)      │
│    • Widget Flash-Briefing TSB (10-min Toolbox Talk) avec émargement rapide            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 5. SECTION PIF TECHNICIENS (Réutilisation DpsFilialePifSection)                        │
│    Cartes techniciens regroupées par paliers MEDACAP :                                 │
│    • 🔵 Junior / Maintenance (#1a56db)                                                 │
│    • 🟠 Senior / Réparation (#e67e00)                                                  │
│    • 🟢 Expert / Diagnostic (#1aab5b)                                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 6. SECTION ESCALADE DIAGNOSTIC                                                         │
│    Tableau des dossiers d'assistance niveau 2 + bouton d'escalade vers l'Academy       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Inventaire des Briques LEGO Réutilisées du Portail DPS

| Composant LEGO | Provenance DPS | Usage dans `KI-Gemini` |
|---|---|---|
| **`PortalHeader.jsx`** | `components/` | En-tête officiel avec salutation, puce rôle et `KiHeroCard` intégrée. |
| **`PortalStickyBar.jsx`** | `components/` | Barre flottante de navigation rapide (`#bilan`, `#fad`, `#dojo-atelier`, `#toyota-resultats`, `#toyota-pif`, `#escalade`). |
| **`PortalSectionHead.jsx`** | `components/` | Titrage standardisé avec eyebrow, icône vectorielle et mention méthodologique. |
| **`PlanEntryCard.jsx`** | `components/` | Cartes blanches structurées à bordure latérale colorée (PIF techniciens, résultats). |
| **`PvCard.jsx`** | `components/` | Cartes d'attestations et de formations personnelles. |
| **`DpsCompetencyTierTheme.js`** | `utils/` | Colorimétrie officielle des 3 paliers MEDACAP (Junior `#1a56db`, Senior `#e67e00`, Expert `#1aab5b`). |
| **`PortalReveal.jsx` & `PortalStaggerGrid.jsx`** | `components/` | Animations fluides d'apparition au défilement. |

---

## 3. Les 4 Innovations Interactives Ajoutées

### 1. La Matrice des Compétences Vivante (`KIGeminiSkillHeatmap.jsx`)
* Tableau interactif des 10 techniciens de la filiale.
* Filtre instantané par agence (*Douala, Yaoundé, Bafoussam, Garoua*) et moteur de recherche.
* Score par domaine (*Maintenance, Freinage, Électricité, Diagnostic*) avec pastilles colorées.
* Bouton d'action direct `⚡ Évaluer OJT` sur chaque ligne.

### 2. Le Mode Dojo d'Atelier & Évaluation OJT en Direct (`KIGeminiDojoOjtModal.jsx`)
* Modal plein écran tactile conçue pour l'atelier.
* **Chronomètre intégré** barémé avec pause/reprise.
* **Grille d'observation en 7 étapes TWI** (*Job Instruction*) avec identification des points d'arrêt sécurité impératifs.
* **Double signature tactile** (Visa technicien + Visa Key Instructor).
* Mise à jour en temps réel des notes du technicien dans la heatmap après validation.

### 3. Le Flash-Briefing TSB du Matin (`KIGeminiFlashBriefingCard.jsx`)
* Module de causerie technique de 10 min (*Toolbox Talk*).
* Diffusion des points clés de la campagne qualité (*Toyota Hilux GD-6 : Couple serrage injecteurs*).
* Barre de progression et bouton d'émargement groupé en un clic.

### 4. Le Hub d'Escalade Diagnostic (`KIGeminiEscalationModal.jsx`)
* Formulaire guidé pour les pannes insolubles en agence (VIN, DTC, mesures 5P déjà effectuées).
* Envoi direct au *Flying Doctor* (Eugène EBENE à l'Academy).

---

## 4. Fichiers du Dossier `KI-Gemini`

```
frontend/src/pages/portal/KI-Gemini/
├── KIGeminiDashboard.jsx          # Composant maître de la page
├── README.md                      # Ce document
├── components/
│   ├── KIGeminiSkillHeatmap.jsx   # Matrice thermique interactive
│   ├── KIGeminiDojoOjtModal.jsx   # Modal d'évaluation OJT avec chronomètre et TWI
│   ├── KIGeminiEscalationModal.jsx# Modal de transmission au Flying Doctor
│   └── KIGeminiFlashBriefingCard.jsx # Carte de causerie technique TSB
├── data/
│   └── kiGeminiData.js            # Jeu de données complet (10 techniciens, FAD, TSB)
└── styles/
    └── kiGemini.css               # Styles harmonisés avec le Design System
```
