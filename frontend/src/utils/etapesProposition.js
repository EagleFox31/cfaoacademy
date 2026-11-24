/**
 * Suivi d'une proposition de modification (miroir de PortalSuggestion.Statut côté core).
 * Envoyée → Lue → Planifiée (échéance) → En ligne ; ou Non retenue (motif).
 * Libellés : namespace `portal`, clés `proposition_etape_<statut>`.
 */

/** Étapes de la frise, dans l'ordre, avec le champ de date renvoyé par core. */
export const ETAPES_FRISE = [
  { statut: 'nouvelle', date: 'created_at' },
  { statut: 'lue', date: 'lue_le' },
  { statut: 'planifiee', date: 'planifiee_le' },
  { statut: 'en_ligne', date: 'en_ligne_le' },
]

export const NON_RETENUE = 'non_retenue'

/** Tous les statuts, dans l'ordre du choix du superadmin. */
export const STATUTS = [...ETAPES_FRISE.map(e => e.statut), NON_RETENUE]

const STATUTS_CONNUS = new Set(STATUTS)

/** Statut lisible : un statut inconnu (ancienne donnée) vaut « Envoyée ». */
export const statutDe = p => (STATUTS_CONNUS.has(p?.statut) ? p.statut : 'nouvelle')

/** Terminée : en ligne ou non retenue. */
export const estTerminee = p => ['en_ligne', NON_RETENUE].includes(statutDe(p))

/**
 * Clé d'un changement d'étape vu par l'auteur : un nouveau passage (ou une
 * nouvelle date prévue) donne une nouvelle clé, donc une nouvelle notification.
 */
export const cleChangement = p => `${p.id}:${statutDe(p)}:${p.etape_le ?? ''}`

/** Changement que l'auteur doit voir : toute étape après Envoyée. */
export const aUnChangement = p => statutDe(p) !== 'nouvelle'

/** Libellé de l'étape, avec la date prévue pour Planifiée. */
export function libelleEtape(p, t, locale) {
  const statut = statutDe(p)
  const libelle = t[`proposition_etape_${statut}`] ?? statut
  if (statut === 'planifiee' && p.echeance) {
    return `${libelle} · ${(t.proposition_prevue_le ?? '{date}').replace('{date}', dateCourte(p.echeance, locale))}`
  }
  return libelle
}

/** « 15 déc. 2026 » ; chaîne vide si la date est illisible. Une date seule (AAAA-MM-JJ) reste ce jour-là. */
export function dateCourte(valeur, locale) {
  if (!valeur) return ''
  const d = /^\d{4}-\d{2}-\d{2}$/.test(valeur) ? new Date(`${valeur}T12:00:00`) : new Date(valeur)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
}
