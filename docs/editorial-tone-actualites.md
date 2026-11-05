# Ton éditorial — Actualités CFAO Academy

Guide de rédaction pour les articles `/actualites` (événements, sessions, certifications).  
**Référence validée** : article `toyota-formateur-certification-douala-2026` (`frontend/src/data/articles/article-011.json`).

---

## Intention

Raconter une **session en mouvement**, pas un compte rendu administratif. Le lecteur doit *voir* l’atelier, entendre le tempo, comprendre l’enjeu réseau — surtout quand une **vidéo** accompagne l’article.

| Viser | Éviter |
|-------|--------|
| Récit vivant, rythmé | Liste de faits ou ton « procès-verbal » |
| Phrases courtes qui enchaînent | Paragraphes denses, une seule longue phrase |
| Verbes d’action et de regard | Nominalisations (*la structuration de*, *la consolidation de*) |
| Mise en scène (salle, plateau, débriefs) | Jargon interne non expliqué |

---

## Architecture d’un article

### 1. Chapô (intro)

2–3 phrases. Pose le **lieu**, la **nature de la session** et l’**ambiance** (rythme, exigence, équipe mobilisée). Pas de noms détaillés ici — ils viennent dans les sections.

**Exemple :**
> Au centre CFAO Academy de Douala, la montée en compétences ne s'arrête pas au technicien confirmé : elle prépare ceux qui transmettront demain. Cette session formateur Toyota en est la vitrine — rythmée, exigeante, portée par une équipe pleinement mobilisée.

### 2. Corps en sections (`## Titre`)

Dans le JSON, les titres de section utilisent le préfixe Markdown `##` (parsé par `ArticleBody`).

Ordre type pour une session formation :

1. **Les acteurs / futurs formateurs** — qui, d’où, quelle ambition, qui supervise
2. **Théorie et pratique** — citation + méthode de formation
3. **En atelier** — mise en situation, enjeu pour demain
4. **Certifications remises** — clôture symbolique + portée réseau / hub régional

Titres : **courts**, en minuscules sauf première lettre (`## En atelier`), sauf acronymes (RDC, CFAO).

### 3. Citation

Une **courte** pull-quote (≤ ~120 caractères idéalement), en français typographique avec « … ».  
Placer **seule** dans son paragraphe — le parser la met en `.article-pullquote`.

Accrocher la suite avec une formule du type :
- *C'est ainsi que [Nom], [fonction], résume la méthode dans la vidéo.*
- Éviter : *X le rappelle / le développe dans la vidéo* (trop mécanique).

### 4. Chute de section / article

Dernière phrase **marquante** : symbole + sens réseau.  
Formules efficaces : *Plus qu'un symbole…*, *Et une confirmation de plus…*, *La session se referme sur un moment fort…*

---

## Rythme et syntaxe

### Ouvrir fort

Préférer une amorce concrète à une structure abstraite.

| ❌ Compte rendu | ✅ Récit |
|----------------|----------|
| Deux parcours ont structuré cette promotion | Ils sont deux. |
| Leur ambition est claire — devenir… | Une même ambition : devenir… |

### Alterner les registres

Enchaîner :
- phrase nominale ou très courte ;
- développement avec tirets ou deux-points ;
- paire symétrique (*D'un côté… De l'autre…*) ;
- liste de verbes (*démontent, remontent, ajustent*).

### Verbes et tournures recommandés

- **Accompagnement** : *guidés pas à pas*, *sous l'œil de leur référent*
- **Pédagogie** : *ancrent les fondamentaux*, *veillent à ce que chaque geste reste fidèle*
- **Lieu / action** : *le plateau*, *capte ce tempo*, *se referme sur*
- **Réseau** : *filiale*, *hub régional*, *montée en compétences*, *exigences du constructeur*

### À limiter

- *ont structuré cette promotion*, *préalablement édifiés*, *consolident les connaissances* (correct mais froid)
- *restitue*, *développe dans la vidéo*, *conclut par* (préférer *capte*, *résume*, *se referme sur*)
- Répéter *techniciens* à chaque phrase — varier avec *pairs*, *formateurs en devenir*
- Le mot **pédagogique** / *pedagogical* dans les actualités — préférer *formation*, *formateurs*, *équipe mobilisée*

---

## Personnes et lieux

- **Noms propres** : prénom + NOM en majuscules pour les responsables (*Laurent GONIN*, *Eugène EBENE*).
- **Pays / filiales** : RDC, Sénégal, Cameroun — pas besoin de répéter le pays sous chaque portrait si le drapeau ou le texte l’a déjà dit.
- **Fonctions** : une fois complète (*Directeur du Centre de Formation*), ensuite prénom seul si le contexte est clair.

---

## Lien avec la vidéo

La vidéo n’est pas un détail : c’est le **fil rouge**.

- Mentionner *dans la vidéo* une fois par section max, de façon naturelle.
- Décrire ce qu’**elle montre** (*capte ce tempo*, *salle, atelier, débriefs*) plutôt que *la vidéo est disponible*.

---

## Traductions EN / PT

Fichiers : `frontend/src/i18n/articleBodies.js` (+ titres/résumés dans `articles.js`).

- Conserver la ** même structure** (`##` sections, citation entre « » ou « » selon locale).
- Reproduire le **rythme** (phrases courtes, paires *On one side… On the other…* / *De um lado… Do outro…*).
- Ne pas sur-traduire littéralement : *Ils sont deux* → *There are two of them* / *São dois*.

---

## Format technique (JSON article)

```json
{
  "contenu": "Chapô…\n\n## Les futurs formateurs\n\nCorps…\n\n## Théorie et pratique\n\n« Citation courte. »\n\nSuite après citation…"
}
```

Champs associés (article riche) : `highlights`, `cast`, `castTitle`, `photos`, `photos.captures` (frame vidéo), `videos`.

---

## Checklist avant publication

- [ ] Chapô sans surcharge de noms
- [ ] Sections `##` avec titres courts
- [ ] Au moins une citation en pull-quote
- [ ] Une paire *D'un côté / De l'autre* ou équivalent si théorie + pratique
- [ ] Enjeu « demain » (rôle formateur, réseau) explicite
- [ ] Chute qui dépasse le symbolisme (*Plus qu'un symbole…*)
- [ ] EN + PT alignés sur le même découpage
- [ ] Relecture à voix haute : le texte « respire-t-il » ?

---

## Extrait de référence (FR)

```text
## Les futurs formateurs

Ils sont deux. Jacques Mavila, venu de RDC, et Allassane Diallo, du Sénégal. Une même ambition : devenir formateurs Toyota — d'abord dans leur filiale, puis partout où le réseau aura besoin de leur expertise. Pour les y préparer, Eugène EBENE, formateur Toyota au Cameroun, les a guidés pas à pas dans le processus de certification et dans l'art d'accompagner, à leur tour, d'autres techniciens.

## Théorie et pratique

« La formation combine théorie et pratique — l'e-learning pour la connaissance, l'atelier pour le geste. »

C'est ainsi que Laurent GONIN, Directeur du Centre de Formation, résume la méthode dans la vidéo. D'un côté, des modules e-learning qui ancrent les fondamentaux techniques Toyota. De l'autre, le plateau : des techniciens en activité démontent, remontent, ajustent. Jacques, Allassane et leurs pairs observent, accompagnent, notent — et veillent à ce que chaque geste reste fidèle aux exigences du constructeur.
```

---

*Dernière validation : juin 2026 — session formateur Toyota, Douala.*
