# Norme visuelle — paliers compétence MEDACAP (portail DPS)

Référence unique pour coder **Maintenance / Réparation / Diagnostic** (Mongo : `brandJunior` / `brandSenior` / `brandExpert` → `junior` / `senior` / `expert`).

> Modèle métier complet (GF, tests multimarque, union par palier) : [`medacap-competency-model.md`](./medacap-competency-model.md).

## Règle couleur (obligatoire)

| Palier | Libellé FR | Couleur | Hex |
|--------|------------|---------|-----|
| `junior` | Maintenance | Bleu | `#1a56db` |
| `senior` | Réparation | Orange | `#e67e00` |
| `expert` | Diagnostic | Vert | `#1aab5b` |

**Une seule couleur par palier**, appliquée partout où le palier est affiché :

1. **Bordure carte** (`PvCard` → `accentColor` / `--pv-accent`, barre gauche 4px + coin au survol)
2. **Puce niveau** — fond **blanc**, texte et contour = couleur palier
3. **Initiales nom** — fond **blanc**, lettres et anneau = couleur palier

Ne pas réutiliser `progress` / `done` / `certified` du portail équipe pour les paliers MEDACAP.

## Implémentation

| Rôle | Fichier |
|------|---------|
| Constantes + helpers | `frontend/src/utils/dpsCompetencyTierTheme.js` |
| Puce palier | `frontend/src/components/DpsCompetencyTierChip.jsx` |
| Titre + initiales | `frontend/src/components/DpsCompetencyTierMemberTitle.jsx` |
| Styles CSS | `frontend/src/styles/portal.css` — `.portal-tier-junior\|senior\|expert`, `.portal-card-member-title--tier-*` |

### Exemple carte collaborateur

```jsx
import DpsCompetencyTierChip from './DpsCompetencyTierChip.jsx'
import DpsCompetencyTierMemberTitle from './DpsCompetencyTierMemberTitle.jsx'
import { dpsCompetencyTierAccent } from '../utils/dpsCompetencyTierTheme.js'

<PvCard
  accentColor={dpsCompetencyTierAccent(technician.primaryTier)}
  kicker={<DpsCompetencyTierChip tier={technician.primaryTier} t={t} />}
  title={<DpsCompetencyTierMemberTitle name={technician.name} tier={technician.primaryTier} />}
/>
```

### i18n

Libellés : clés `cert_level_maintenance`, `cert_level_repair`, `cert_level_diagnostic` dans `frontend/src/i18n/portal.js` (via `DPS_COMPETENCY_TIER_LABEL_KEY`).

## Hors scope de cette norme

- **Scores tests** (rouge / orange / vert selon note) — `evalScoreTier` dans `learnerTests.js`
- **Statuts PIF / session** — `portal-status-chip` génériques (`todo`, `progress`, `done`)
- **Cartes manager équipe** — `TeamMemberCard` (certifié / alerte / en cours)

Toute nouvelle surface DPS affichant un palier compétence doit importer les composants ci-dessus, pas redéfinir les couleurs localement.
