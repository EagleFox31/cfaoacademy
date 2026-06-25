# CFAO Academy — Design System

Documentation de référence du design system, couvrant l'accueil et le portail apprenant.
Sources : `frontend/src/styles/`, `frontend/src/components/`, `frontend/src/pages/`, `frontend/src/i18n/`.

---

## Sommaire

1. [Tokens de couleur](#1-tokens-de-couleur)
2. [Typographie](#2-typographie)
3. [Layout & espacement](#3-layout--espacement)
4. [Navigation](#4-navigation)
5. [Sections & motif zebra](#5-sections--motif-zebra)
6. [Hero](#6-hero)
7. [Cartes PvCard](#7-cartes-pvcard)
8. [Portail apprenant — structure](#8-portail-apprenant--structure)
9. [Portail — composants de section](#9-portail--composants-de-section)
10. [Boutons & CTA](#10-boutons--cta)
11. [Modales](#11-modales)
12. [Formulaires & entrees](#12-formulaires--entrees)
13. [Marques brands](#13-marques-brands)
14. [Logos — regles d'affichage](#14-logos--regles-daffichage)
15. [Tags & chips](#15-tags--chips)
16. [Animations & transitions](#16-animations--transitions)
17. [Responsive & breakpoints](#17-responsive--breakpoints)
18. [Z-index stack](#18-z-index-stack)
19. [i18n — cles portail](#19-i18n--cles-portail)

---

## 1. Tokens de couleur

Definis dans `frontend/src/styles/index.css`. A utiliser via `var(--token)`, jamais en valeur brute.

```css
:root {
  /* Rouge CFAO */
  --red:        #E3001B;   /* Principal : actions, accents, highlights */
  --red-deep:   #B40015;   /* Hover / active */
  --red-soft:   #FFE5E8;   /* Fond teinte rouge tres doux */

  /* Marine */
  --navy:       #1A1F3C;   /* Sections sombres, texte principal */
  --navy-2:     #2A3157;
  --navy-3:     #3D4470;

  /* Texte & surfaces */
  --ink:        #0E1126;   /* Noir quasi-pur (titres) */
  --paper:      #FFFFFF;
  --paper-2:    #FAFAFA;
  --paper-3:    #F5F5F5;

  /* Neutres */
  --rule:       #E7E7EA;   /* Bordures, separateurs */
  --muted:      #6B6F82;   /* Texte secondaire */
  --muted-2:    #9499AB;   /* Texte tertiaire */
}
```

### Couleurs semantiques derivees

| Usage | Valeur |
|---|---|
| Succes / valide (section claire) | `#1aab5b` |
| Succes / valide (section sombre) | `#3dcc78` |
| Alerte / echec | `var(--red)` |
| Fond section paire (navy) | `rgba(26,31,60,0.72)` |
| Fond section impaire (clair) | `rgba(255,255,255,0.78)` |
| Overlay modal | `rgba(14,17,38,0.55)` |

---

## 2. Typographie

### Familles

| Role | Famille | Usage |
|---|---|---|
| Titres h1-h3 | `'Space Grotesk'`, sans-serif | Headings, valeurs KPI |
| Corps | `'DM Sans'`, system-ui, sans-serif | Paragraphes, labels, boutons |
| UI mono / eyebrow | `'JetBrains Mono'`, ui-monospace | Tags, codes, eyebrows, badges |

### Titres

```css
h1, h2, h3 {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.02;
}
```

- **H1 hero** : `clamp(48px, 6.4vw, 96px)`
- **H2 section** : `clamp(36px, 4.2vw, 64px)`
- **H3 card** : `clamp(16px, 1.4vw, 20px)`

### Eyebrow / kicker (`.pv-ix`, `.eyebrow`, `.kicker`)

```css
font-family: 'JetBrains Mono';
font-size: 11px;
font-weight: 500;
letter-spacing: 0.14em;
text-transform: uppercase;
color: var(--red);
```

Toujours precede d'une ligne decorative via `::before` :

```css
.pv-ix::before {
  content: '';
  display: inline-block;
  width: 24px;
  height: 2px;
  background: var(--red);
  vertical-align: middle;
  margin-right: 10px;
}
```

---

## 3. Layout & espacement

### Container

```css
.container {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 32px;
}
```

### Padding de section

| Type | Valeur |
|---|---|
| Standard | `80px 0` |
| Tight | `40px 0` |
| Portal section | `48px 0` |
| Portal discover | `14px 0` |

### Gaps frequents

| Contexte | Gap |
|---|---|
| Grille de cartes | `20px` |
| Grille de sections | `24px` |
| Section head 2 colonnes | `64px` |
| Colonnes internes card | `32px` |

### Border-radius

| Composant | Valeur |
|---|---|
| Boutons | `999px` pill |
| Grandes cartes / modales | `24px` |
| Cartes standard | `16px` |
| Petites cartes / inputs | `10-12px` |
| Images hero | `24px` |
| Logos mini | `5px` |

### Ombres

| Nom | Valeur |
|---|---|
| Subtle | `0 1px 3px rgba(14,17,38,0.06)` |
| Small | `0 2px 12px rgba(14,17,38,0.06)` |
| Medium | `0 4px 20px rgba(14,17,38,0.10)` |
| Large | `0 16px 48px rgba(14,17,38,0.14)` |
| Hero image | `0 24px 56px -20px rgba(26,31,60,0.25)` |
| Modal | `0 24px 64px rgba(14,17,38,0.22)` |

---

## 4. Navigation

**Fichiers** : `Nav.jsx` + `index.css`

```css
.nav-shell {
  position: sticky;
  top: 0;
  z-index: 50;
  min-height: 76px;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(26,31,60,0.14);
}
```

### Grille nav (3 zones)

```
[Logo + label]  |  [Menu liens centre]  |  [CTAs : Login + Inscription]
```

### Variantes

| Classe | Contexte |
|---|---|
| `.nav--home` | Homepage — CTAs fantomes |
| `.nav--portal` | Portail — UserMenu remplace les CTAs |

### Boutons nav

```css
.nav-cta {
  padding: 11px 20px;
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 600;
  background: var(--navy);
  color: #fff;
}
.nav-cta:hover       { background: var(--red); }
.nav-cta--ghost      { background: transparent; border: 1.5px solid var(--rule); color: var(--ink); }
.nav-cta--primary    { background: var(--red); }
```

Lien "Retour au site" (portail) — cle i18n `nav_home`.

---

## 5. Sections & motif zebra

### Pattern d'alternance

```css
section:nth-of-type(odd)  { background: rgba(255,255,255,0.78); }
section:nth-of-type(even) { background: rgba(26,31,60,0.72); }

section:nth-of-type(even) h2,
section:nth-of-type(even) h3    { color: #fff; }
section:nth-of-type(even) .pv-ix { color: var(--red); }
section:nth-of-type(even) p     { color: rgba(255,255,255,0.72); }
section:nth-of-type(even) hr    { border-color: rgba(255,255,255,0.12); }
```

### Section head (`.section-head`)

```
[Col 1 : 1fr]                    [Col 2 : 1.3fr]
eyebrow (pv-ix)                  Description 17px max-width 540px
h2 clamp(36px, 4.2vw, 64px)      Lien CTA optionnel
```

### Section head portail (`.portal-section-head`)

```css
.portal-section-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 24px;
}
.portal-section-head h2 {
  font-size: clamp(20px, 2vw, 24px);
  font-weight: 700;
}
```

---

## 6. Hero

**Fichiers** : `HomeHero.jsx` / `PageHero.jsx`

```css
.hero {
  min-height: 46vh;   /* 72vh mobile */
  position: relative;
  overflow: hidden;
}
.hero-overlay {
  background: linear-gradient(
    135deg,
    rgba(14,17,38,0.92) 0%,
    rgba(14,17,38,0.50) 100%
  );
}
.hero-content { max-width: 740px; }
```

| Element | Style |
|---|---|
| `.hero-top` | Eyebrow + dot rouge 8px |
| `.hero-h1` | `clamp(48px, 6.4vw, 96px)`, Space Grotesk 600 |
| `.hero-h1 .accent` | `font-style: italic; color: var(--red)` |
| `.hero-sub` | DM Sans 18px, `rgba(255,255,255,0.80)` |
| `.hero-ctas` | Flex gap 16px |
| `.hero-img` | Aspect 4/5, border-radius 24px |

### Floating card (`.hero-floating-card`)

Petite carte blanche positionnee en bas de l'image hero.

```css
.hero-floating-card {
  background: var(--paper);
  border-radius: 16px;
  padding: 16px 20px;
  box-shadow: 0 8px 32px rgba(14,17,38,0.16);
}
```

### Glass panel

**Regle absolue** : tout texte hero ou header portail doit etre dans un `.glass-panel`. Jamais pose directement sur le fond.

```css
.glass-panel {
  background: rgba(255,255,255,0.08);
  backdrop-filter: blur(12px) saturate(140%);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 20px;
}
```

---

## 7. Cartes PvCard

**Fichiers** : `PvCard.jsx` + `academy.css`

### Structure

```
.pv-card
+-- .pv-card-img                  (Image 180px, object-fit: cover)
+-- .pv-card-body
    +-- .pv-card-brand-row        (Logo marque + aside : duree, badge)
    +-- .kicker                   (Eyebrow JetBrains Mono rouge)
    +-- h3                        (Titre)
    +-- .meta                     (Date, niveau, modalite)
    +-- .pv-card-cta              (Lien ou bouton)
    +-- .corner                   (Icone fleche, position: absolute)
+-- .pv-card-hover-hint           ("-> Voir" revele au hover)
```

### Styles de base

```css
.pv-card {
  border-radius: 16px;
  background: var(--paper);
  border-left: 4px solid var(--pv-accent, var(--red));
  box-shadow: 0 2px 12px rgba(14,17,38,0.06);
  transition: transform .25s ease, box-shadow .25s ease;
}
.pv-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 16px 48px rgba(14,17,38,0.14);
}
.pv-card-img { height: 180px; overflow: hidden; }
.pv-card:hover .pv-card-img img { transform: scale(1.05); }
```

### Variantes

| Classe | Comportement |
|---|---|
| `.pv-card--doc` | `object-position: top` sur l'image |
| `.pv-card--brand` | Logo en haut, padding 22px, sans image portrait |
| `.pv-card--quote` | Style citation, sans image |
| `.pv-card--locked` | `filter: grayscale(1); opacity: 0.6` + badge "Bientot" |

### Accent par marque

```css
.pv-card[data-brand="toyota"]   { --pv-accent: #EB0A1E; }
.pv-card[data-brand="mercedes"] { --pv-accent: #888; }
.pv-card[data-brand="suzuki"]   { --pv-accent: #004b9e; }
```

---

## 8. Portail apprenant — structure

### Pages

| Route | Composant | Roles |
|---|---|---|
| `/portal` | `LearnerDashboard.jsx` | learner, ki |
| `/portal/team` | `TeamDashboard.jsx` | team_manager |
| `/portal/branch` | `BranchDashboard.jsx` | workshop_manager |
| `/portal/hr` | `HrDashboard.jsx` | branch_hr |
| `/portal/admin` | `AdminDashboard.jsx` | superadmin |

### Squelette LearnerDashboard

```jsx
<Nav />
<PortalStickyBar user={user} lms={lms} headerRef={headerRef} />

<main className="portal-page">
  <div ref={headerRef}>
    <PortalHeader user={user} lms={lms} />
  </div>

  <PreviewSection />         {/* Vue d'ensemble - KPIs */}
  <ModulesSection />         {/* Mes modules */}
  <EvaluationsSection />     {/* Mes evaluations */}
  <CertificationsSection />  {/* Mes certifications */}
  <PlanSection />            {/* Mon plan */}
  <AssistanceSection />      {/* Assistance */}
</main>
```

### Portal Header

Layout :
```
[Role badge]       [Greeting anime "Bonjour, Kouame"]
[Flag + Filiale + Concession]
[Logos marques]    [Cert level chips]    [Progress goal bar]
```

**Role badge :**
```css
.portal-role-badge {
  font-family: 'JetBrains Mono';
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(227,0,27,0.1);
  color: var(--red);
  padding: 5px 14px 5px 10px;
  border-radius: 20px;
}
```

**Greeting :** Prenom en `color: var(--red); font-style: italic`. Animation `portal-greeting-in` 0.5s.

**Geo row :** drapeaux 24x16px border-radius 3px, filiale 14px font-weight 600 color --muted, separateurs `1px solid var(--rule)`.

**Logos marques (header) :** wrap 88x52px, border `1px solid var(--rule)`, shadow subtle, fond blanc.

### Sticky bar

Apparait quand le PortalHeader sort du viewport (IntersectionObserver).

```css
.portal-sticky-bar {
  position: fixed;
  top: 76px;           /* sous la nav */
  left: 0; right: 0;
  z-index: 49;
  height: 44px;
  background: var(--navy);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  transform: translateY(-100%);
  opacity: 0;
  transition: transform 0.25s ease, opacity 0.2s ease;
}
.portal-sticky-bar--visible {
  transform: translateY(0);
  opacity: 1;
}
```

**Contenu (gauche -> droite) :**

1. Logos marques — `height: 20px; filter: brightness(0) invert(1); opacity: 0.8`
2. Cert chips — JetBrains Mono 11px, `color: rgba(255,255,255,0.5)`, niveau en bold blanc
3. Progress bar — `120px x 4px`, fond `rgba(255,255,255,0.12)`, fill `var(--red)`, pourcentage JetBrains Mono 12px 700 `var(--red)`

**Pas de nom/avatar** dans la sticky bar — deja present dans le UserMenu de la nav.

---

## 9. Portail — composants de section

### KPI Cards (`.portal-kpi-card`)

```css
.portal-kpi-card { padding: 22px 20px 18px; border-radius: 16px; }
.portal-kpi-value {
  font-family: 'Space Grotesk';
  font-size: 36px;
  font-weight: 700;
  color: var(--navy);
}
.portal-kpi-value.accent { color: var(--red); }
.portal-kpi-value.green  { color: #1aab5b; }

/* Section sombre */
section:nth-of-type(even) .portal-kpi-value        { color: #fff; }
section:nth-of-type(even) .portal-kpi-value.accent { color: #ff6b7a; }
section:nth-of-type(even) .portal-kpi-value.green  { color: #3dcc78; }
```

### Session Cards (`.portal-session-card`)

```css
.portal-session-card {
  border-left: 4px solid var(--red);
  border-radius: 12px;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 20px;
}
.portal-session-date-block {
  width: 54px; height: 54px;
  background: var(--red);
  color: #fff;
  border-radius: 12px;
}
.portal-session-day   { font-size: 22px; font-weight: 700; font-family: 'Space Grotesk'; }
.portal-session-month { font-size: 10px; font-family: 'JetBrains Mono'; }
```

### Module Cards (`.portal-module-card`)

```css
.portal-module-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
  border-radius: 12px;
}
.portal-module-icon { width: 42px; height: 42px; border-radius: 12px; }
.portal-module-icon.todo     { background: rgba(107,111,130,0.12); color: var(--muted); }
.portal-module-icon.progress { background: rgba(227,0,27,0.10);   color: var(--red); }
.portal-module-icon.done     { background: rgba(26,171,91,0.12);  color: #1aab5b; }
```

### Eval Cards (`.portal-eval-card`)

```css
.portal-eval-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-radius: 12px;
}
.portal-eval-score      { font-family: 'Space Grotesk'; font-size: 22px; font-weight: 700; color: #1aab5b; }
.portal-eval-score.fail { color: var(--red); }
```

### Certification Cards (`.portal-cert-card`)

```css
.portal-cert-card { border-radius: 16px; padding: 24px; cursor: pointer; }
.portal-cert-meta { font-family: 'JetBrains Mono'; font-size: 11px; color: var(--muted); }
```

**Champs affiches :** `title`, `brand`, `certId`, `level`, `date`.
**Champ supprime :** `validUntil` — ni dans la card ni dans la modal detail.

### Plan Entry Cards (`.portal-plan-entry`)

```css
.portal-plan-entry {
  border-radius: 12px;
  padding: 18px 20px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 16px;
  align-items: center;
}
```

---

## 10. Boutons & CTA

### Bouton generique (`.btn`)

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 22px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  font-family: 'DM Sans';
  transition: background .18s, color .18s, box-shadow .18s;
}
.btn-primary       { background: var(--red);   color: #fff; }
.btn-primary:hover { background: var(--red-deep); }
.btn-ghost         { background: transparent;  border: 1.5px solid var(--rule); color: var(--ink); }
.btn-dark          { background: var(--navy);  color: #fff; }
```

### CTA lien (`.pv-cta-link`)

```css
.pv-cta-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--navy);
}
.pv-cta-link--primary { background: #1a56db; color: #fff; padding: 10px 18px; border-radius: 999px; }
.pv-cta-link--alt     { border: 1.5px solid var(--red); color: var(--red); padding: 9px 16px; border-radius: 999px; }
```

### Double CTA (pattern deux actions)

```jsx
<div className="pv-dual-cta">
  <a className="pv-cta-link pv-cta-link--primary">Action principale</a>
  <a className="pv-cta-link pv-cta-link--alt">Action secondaire</a>
</div>
```

---

## 11. Modales

**Fichier** : `PortalModal.jsx`

```css
.portal-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(14,17,38,0.55);
  backdrop-filter: blur(4px);
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}
.portal-modal {
  max-width: 560px;
  background: var(--paper);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(14,17,38,0.22);
  animation: modal-in .18s ease;
}
@keyframes modal-in {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
.portal-modal-header { padding: 20px 24px 16px; border-bottom: 1px solid var(--rule); }
.portal-modal-title  { font-size: 16px; font-weight: 700; }
.portal-modal-close  { width: 32px; height: 32px; border-radius: 999px; }
.portal-modal-close:hover { background: var(--rule); }
.portal-modal-body   { padding: 20px 24px 24px; overflow-y: auto; }
```

---

## 12. Formulaires & entrees

### Input texte

```css
input, .portal-hr-search {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--rule);
  font-size: 14px;
  background: var(--paper);
  box-shadow: 0 1px 4px rgba(14,17,38,0.06);
}
input:focus {
  border-color: var(--red);
  outline: none;
  box-shadow: 0 0 0 3px rgba(227,0,27,0.12);
}
```

### Select (section sombre)

```css
.portal-demo-bar-select {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.85);
  border-radius: 8px;
  padding: 8px 12px;
}
.portal-demo-bar-select:focus { border-color: rgba(227,0,27,0.6); }
```

---

## 13. Marques brands

**Source** : `frontend/src/data/index.js`

### Schema

```js
{
  id:      string,         // slug : 'toyota', 'renault-trucks'
  name:    string,
  logo:    string,         // 'assets/logos/toyota.png'
  cat:     string,         // label categorie humain
  group:   'vl' | 'moto' | 'camions' | 'bus' | 'chariots' | 'engins',
  bu:      'motors' | 'equipment',
  n:       number,         // nb de formations
  niveaux: string,         // ex: 'G4 -> G3 -> G2 -> G1'
}
```

### Catalogue complet

#### Vehicules legers — Motors (VL)

| Marque | Logo | Niveaux cert | Formations |
|---|---|---|---|
| Toyota | `toyota.png` | G4 -> G3 -> G2 -> G1 | 48 |
| Mercedes-Benz | `mercedes.png` | BASIC -> CERTIFIED | 12 |
| Suzuki | `suzuki.png` | Bronze -> Silver -> Gold | 14 |
| BYD | `byd.png` | BEV Level 1-3 | 9 |
| Mitsubishi | `mitsubishi.png` | Step 1-3 | 7 |
| Omoda & Jaecoo | `omoda.png` | Premium | 5 |
| Stellantis | `stellantis.png` | Citroen / Peugeot / Jeep / Fiat | 8 |
| Citroen | `citroen.png` | Stellantis | 4 |
| Yamaha | `yamaha.png` | Moto & Bateaux | 6 |

#### Poids lourds & bus — Equipment

| Marque | Logo | Segment | Formations |
|---|---|---|---|
| Renault Trucks | `renault-trucks.png` | Camions | 9 |
| Hino | `hino.png` | Camions | 11 |
| Fuso | `fuso.png` | Camions utilitaires | 6 |
| Sinotruk | `sinotruk.png` | Camions lourds | 18 |
| Shacman | `shacman.png` | Camions BTP | 7 |
| Mercedes Trucks | `mercedes.png` | Trucks premium | 6 |
| King Long | `kinglong.png` | Bus | 4 |

#### Manutention & construction

| Marque | Logo | Segment | Formations |
|---|---|---|---|
| BT | `bt.png` | Chariots elevateurs | 3 |
| Toyota Material Handling | `toyota-forklift.png` | Chariots | 8 |
| JCB | `jcb.png` | Engins TP | 8 |
| Lovol | `lovol.png` | Agri & Engins | 11 |

### Niveaux Toyota (reference)

```
G4  Junior / Maintenance       (entree)
G3  Senior / Reparation
G2  Expert / Diagnostic
G1  Master / Expert diagnostic (sommet)
```

---

## 14. Logos — regles d'affichage

Tous dans `public/assets/logos/` — references en `/assets/logos/[slug].png`.

| Contexte | Taille | Traitement CSS |
|---|---|---|
| Nav principale | `height: 32px` | Couleur originale |
| Portal header | wrap `88x52px`, border `var(--rule)`, shadow | Couleur originale, fond blanc |
| Sticky bar portail | `height: 20px` | `filter: brightness(0) invert(1); opacity: 0.8` |
| Brand chip inline | `height: 16px` | Couleur originale |
| PvCard brand-row | `height: 22px` | Couleur originale |
| Brand wall accueil | `max-height: 48px` | Couleur originale |
| Logo marquee animee | `height: 28px` | `filter: grayscale(1); opacity: 0.5` |
| Section sombre navy | — | `filter: brightness(0) invert(1)` |

### Wrap logo (`.brand-logo-wrap`)

```css
.brand-logo-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--paper);
  border-radius: 5px;
  width: 36px; height: 22px;
  padding: 2px 4px;
  flex-shrink: 0;
}
```

### Constante BRAND_LOGOS

```js
const BRAND_LOGOS = {
  toyota:         '/assets/logos/toyota.png',
  mercedes:       '/assets/logos/mercedes.png',
  suzuki:         '/assets/logos/suzuki.png',
  renault_trucks: '/assets/logos/renault-trucks.png',
  hino:           '/assets/logos/hino.png',
  fuso:           '/assets/logos/fuso.png',
  byd:            '/assets/logos/byd.png',
  // ...
}
```

---

## 15. Tags & chips

### Tags sessions / formations (`.tag`)

```css
.tag { font-family: 'JetBrains Mono'; font-size: 11px; padding: 4px 10px; border-radius: 999px; font-weight: 500; }
.tag.motors       { background: #FFF1F2; color: var(--red); }
.tag.equipment    { background: #EEF1FB; color: var(--navy); }
.tag.carrosserie  { background: #FFF7E8; color: #8A5400; }
.tag.parts-motors { background: #E8F5EE; color: #1F6B3F; }
.tag.parts-eq     { background: #F1ECFD; color: #4F3A8F; }
```

### Brand chips portail (`.portal-brand-chip`)

```css
.portal-brand-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 6px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
.portal-brand-chip.toyota   { background: rgba(235,10,30,0.10);   color: #c00016; }
.portal-brand-chip.renault  { background: rgba(255,210,0,0.15);   color: #856900; }
.portal-brand-chip.nissan   { background: rgba(60,80,160,0.10);   color: #2d40a0; }
.portal-brand-chip.mercedes { background: rgba(100,100,100,0.10); color: #555; }
```

### Cert level chips (`.portal-cert-chip`)

```css
.portal-cert-chip {
  font-family: 'JetBrains Mono';
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(227,0,27,0.10);
  color: var(--red);
}
```

### Statuts d'inscription (plan annuel)

| Statut | Couleur |
|---|---|
| `fait` | `#1aab5b` vert |
| `inscrit` | `#1a56db` bleu |
| `a_inscrire` | `var(--red)` |
| `a_programmer` | `var(--muted)` |

---

## 16. Animations & transitions

### Reveal au scroll

```css
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity .8s cubic-bezier(.2,.7,.2,1),
    transform .8s cubic-bezier(.2,.7,.2,1);
}
.reveal.in { opacity: 1; transform: none; }
```

### Stagger (enfants `.reveal-group`)

Chaque `:nth-child(n)` : delay de `n * 80ms` (jusqu'a 8 enfants).

### Hover cards

| Composant | Transform |
|---|---|
| PvCard | `translateY(-5px)` |
| Portal session card | `translateY(-4px)` |
| Portal eval card | `translateY(-3px)` |
| Plan entry card | `translateY(-1px)` |

### Transitions standards

```css
/* Cards */      transition: transform .25s ease, box-shadow .25s ease;
/* Sticky bar */ transition: transform 0.25s ease, opacity 0.2s ease;
/* Boutons */    transition: background .18s, color .18s, box-shadow .18s;
/* Images */     transition: transform .4s ease;
```

### Scroll progress bar

```css
.scroll-progress {
  position: fixed; top: 0; left: 0;
  height: 3px;
  background: var(--red);
  z-index: 100;
}
```

---

## 17. Responsive & breakpoints

| Breakpoint | Comportement |
|---|---|
| `1320px` | Container max-width |
| `1080px` | Grilles -> 2 colonnes (brand wall, kpis) |
| `880px` | Nav links masquees ; layouts -> 1 colonne |
| `600px` | Footer, brand offer -> 1 colonne |

```css
@media (max-width: 880px) {
  .nav-links           { display: none; }
  .hero                { min-height: 72vh; flex-direction: column; }
  .portal-session-card { flex-direction: column; }
  .portal-section      { padding: 32px 0; }
}
```

---

## 18. Z-index stack

| Valeur | Element |
|---|---|
| `500` | Modales (overlay + card) |
| `100` | Scroll progress bar |
| `50` | Nav sticky |
| `49` | Portal sticky bar |
| `45` | Bouton fermeture page slide |
| `5` | Fleches carousel news |
| `2` | Contenu hero |
| `1` | Overlay hero |

---

## 19. i18n — cles portail

**Fichier** : `frontend/src/i18n/portal.js`
**Pattern** : `useLocale(section)` -> `getCopy(section, locale)` -> objet cles plates.
**Regle** : aucun string francais hardcode dans le JSX — tout passe par `t.cle`.

| Groupe | Exemples |
|---|---|
| Salutations | `greeting_morning`, `greeting_afternoon`, `greeting_xmas` |
| Roles | `role_learner`, `role_ki`, `role_team_manager`, `role_dop` |
| KPIs | `kpi_modules_completed`, `kpi_global_progress`, `kpi_certifications` |
| Eyebrows | `eyebrow_overview`, `eyebrow_plan`, `eyebrow_next_session` |
| Titres sections | `section_dashboard`, `section_plan`, `section_certifications` |
| Statuts | `status_done`, `status_progress`, `status_todo`, `status_coming_soon` |
| Modalites | `modality_presentiel`, `modality_elearning`, `modality_coaching` |
| Actions | `cta_see_trainings`, `cta_export_csv` |
| Nav | `nav_home` -> `'Retour au site'` FR / `'Back to site'` EN |

---

*Genere le 2026-06-09 — a maintenir a chaque ajout de token, composant ou marque.*
