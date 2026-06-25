# Portail apprenant — colorimétrie des statuts

> Référence produit + implémentation (`planningSessionAccent`, pastilles `annual_*`).  
> Dernière mise à jour : juin 2026.

## Principes (normes marché)

| Source | Enseignement |
|--------|--------------|
| **RAG** (Red / Amber / Green) — gestion de projet | Vert = dans les clous · Ambre = écart partiel / à surveiller · Rouge = objectif non atteint, action requise |
| **LMS** (SmarterU, Progress Tracker, etc.) | Vert = terminé · Couleur primaire / ambre = en cours · Neutre = pas commencé · Rouge = expiré / en retard |
| **WCAG** (W3C) | Ne jamais coder l’information **uniquement** par la couleur : toujours un libellé texte (pastille « Fait », « Partiel »…) |

CFAO Academy combine :

1. **Statuts session** (granularité formation) — planning annuel.
2. **Statuts agrégés PIF** (granularité marque × année) — dérivés des sessions + contexte temporel.

Code source : `frontend/src/utils/learnerPlanning.js` (`ANNUAL_STATUS_ACCENT`) et `frontend/src/utils/learnerPif.js` (`resolvePifBrandAnnualStatus`).

---

## Statuts session (formation individuelle)

| Clé | Libellé FR | Couleur | Hex / token | Sémantique |
|-----|------------|---------|-------------|------------|
| `fait` | Fait | Vert | `#1aab5b` | Session terminée, compétence validée |
| `en_cours` | En cours | Orange | `#e67e00` | Semaine de formation en cours |
| `inscrit` | Inscrit | Bleu | `#1a56db` | Inscrit à une session datée, en attente |
| `a_inscrire` | À inscrire | Gris foncé | `var(--muted)` / pastille `#0e1126` | Session programmée dans le plan, pas encore inscrit |
| `a_programmer` | À programmer | Gris | `var(--muted)` / pastille `#64748b` | Prévue au plan pluriannuel, pas encore calée sur une session |

**Distinction importante** : *programmé* (`a_programmer`) ≠ *inscrit* (`inscrit`). Une formation peut être reportée d’une année sur l’autre et revenir en `a_programmer` tant qu’aucune session n’est fixée.

---

## Statuts agrégés PIF (carte marque)

Affichés sur la pastille logo, la bordure gauche et le compteur (`--pv-accent`).

| Clé | Libellé FR | Couleur | Règle d’agrégation |
|-----|------------|---------|-------------------|
| `fait` | Fait | Vert | 100 % des formations de la période sont `fait` · ou expert sans formation restante (plan validé) |
| `en_cours` | En cours | Orange | Année **courante ou future** : au moins une `en_cours`, ou déjà commencé (`fait` + reste à faire) |
| `partiel` | Partiel | Orange | Année **passée** : au moins une `fait` mais pas toutes (ex. 1/2) — équivalent RAG **Ambre** |
| `inscrit` | Inscrit | Bleu | Rien de commencé, au moins une inscription confirmée |
| `a_inscrire` | À inscrire | Gris foncé | Sessions connues, aucune inscription |
| `a_programmer` | À programmer | Gris | Rien de calé sur la période (année vide, plan en définition) |
| `non_fait` | Non fait | Rouge | Année **passée**, 0 % fait alors que des sessions étaient attendues (`a_inscrire` / `inscrit`) — équivalent RAG **Rouge** |

### Compteur carte PIF

| Situation | Affichage | Exemple |
|-----------|-----------|---------|
| Tout fait | Total seul | `02 formations dans le plan 2025` |
| Partiel | Ratio | `01/02 faites sur le plan 2025` |
| Année vide | Message grisé | « Aucune formation programmée en 2026 » |

### Exemples

| Contexte | Données | Pastille | Compteur |
|----------|---------|----------|----------|
| 2025 clôturée | 1 fait, 1 jamais inscrit | **Partiel** (orange) | `01/02 faites…` |
| 2024 clôturée | 0 fait, 2 à inscrire | **Non fait** (rouge) | `00/02 faites…` |
| 2026 en cours | 1 fait, 4 à inscrire | **En cours** (orange) | `01/05 faites…` |
| 2026 | 0 fait, 3 à programmer | **À programmer** (gris) | `03 formations…` |
| Pluri | 2 fait, 1 à inscrire en 2026 | **En cours** (orange) | `02/03 faites…` |

---

## Cartographie RAG ↔ CFAO

| RAG | Statuts CFAO typiques |
|-----|----------------------|
| **Green** | `fait` |
| **Amber** | `en_cours`, `partiel` |
| **Blue** *(hors RAG, spécifique inscription)* | `inscrit` |
| **Grey** | `a_programmer`, `a_inscrire` (attente) |
| **Red** | `non_fait` |

---

## Fichiers CSS

| Usage | Fichier | Classes |
|-------|---------|---------|
| Pastille sur image (opaque) | `portal.css` | `.portal-session-status-tag.annual_*` |
| Pastille meta (fond léger) | `portal.css` | `.portal-status-chip.annual_*` |
| Bordure carte | `academy.css` | `--pv-accent` via `PvCard` |
| Compteur PIF | `portal.css` | `#pif .portal-pif-card-count-value { color: var(--pv-accent) }` |

---

## i18n

Clés `annual_*` dans `frontend/src/i18n/portal.js` (fr / en / pt).

---

## Évolutions possibles

- Seuils chiffrés type RAG (ex. partiel si &lt; 80 % réalisé en fin d’année).
- Pastille « reporté » si une formation `a_programmer` en N+1 provient explicitement d’un report N.
- Légende fixe sous les onglets PIF (non implémentée).
