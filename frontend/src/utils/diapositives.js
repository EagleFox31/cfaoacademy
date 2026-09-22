import { periodeLongue } from './compteRendu'

/**
 * Le lien entre les pages de l'assistant et les diapositives du modele.
 *
 * L'assistant compose des pages ; le service d'apercu convertit des
 * diapositives numerotees du `MODELE-REFERENCES.pptx`. Cette table dit
 * laquelle montrer pour chaque page.
 *
 * Les valeurs, elles, sont les drapeaux du modele — les `{nom_complet}`
 * et consorts — que le service substitue avant de convertir. Un drapeau
 * sans valeur reste visible dans l'image : une page incomplete doit se
 * voir plutot que de s'effacer.
 */

/** La diapositive du modele qui correspond a chaque page composee. */
export const DIAPO_PAR_PAGE = {
  couverture: 1,
  objectifs: 9,
  participants: 4,
  deroule: 11,
  resultats: 17,
  bilan: 20,
  fiches: 26,
  cloture: 28,
}

/** Le numero de diapositive d'une page, ou null si elle n'en a pas.
 *
 *  Deux familles de pages se repetent et portent donc une cle indexee :
 *  `jour-1`, `jour-2`... pour le deroule, `fiche-<id>` pour les fiches
 *  individuelles. Toutes partagent le gabarit de leur famille.
 */
export function diapoDe(page) {
  if (!page) return null
  const cle = page.cle || ''
  if (cle.startsWith('jour-')) return DIAPO_PAR_PAGE.deroule
  if (cle.startsWith('fiche-')) return DIAPO_PAR_PAGE.fiches
  return DIAPO_PAR_PAGE[cle] ?? null
}

/** Les drapeaux du modele, renseignes depuis le brouillon. */
export function valeursDrapeaux(brouillon, session, synthese) {
  const b = brouillon || {}
  const t = b.textes || {}
  const periode = periodeLongue(b.debut, b.fin)
  return {
    // Les couvertures du modele portent des mots nus plutot que des
    // drapeaux entre accolades : le service les remplace quand le run
    // ne contient que le mot.
    Titre: b.intitule || '',
    'Sous titre': b.codeFormation || '',
    'Sous-titre': b.codeFormation || '',
    PERIODE: periode,
    periode,
    lieu: b.lieu || '',

    '{titre}': b.intitule || '',
    '{sous_titre}': b.codeFormation || '',
    '{periode}': periode,
    '{lieu}': b.lieu || '',
    '{pays}': b.pays || '',
    '{nb_participants}': String((b.participants || []).length || ''),
    '{taux_progression}': synthese?.progression != null
      ? String(synthese.progression) : '',
    '{taux_acquis}': synthese?.acquis != null ? String(synthese.acquis) : '',
    '{bilan_contexte}': t.contexte || '',
    '{bilan_resultats}': t.resultats || '',
    '{bilan_vigilance}': t.vigilance || '',
    '{bilan_suites}': t.suites || '',
    '{objectifs}': t.objectifs || '',
    '{appréciation_formateur}': t.appreciation || '',
  }
}
