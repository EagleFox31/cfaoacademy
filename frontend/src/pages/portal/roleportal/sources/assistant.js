import { aujourdhui } from '../../../../utils/sessionsAVenir.js'

/** Places d'une session du centre, au plus. */
export const PLACES_MAX = 12

/** Horizon de la section « Prochaines sessions de formation ». */
export const JOURS_A_VENIR = 14

/** `jour` (AAAA-MM-JJ) décalé de `n` jours, au même format. */
function plusJours(jour, n) {
  const d = new Date(`${jour}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Sessions en cours ou qui commencent dans les `jours` qui viennent, par date de début. */
export function sessionsProches(sessions, jour = aujourdhui(), jours = JOURS_A_VENIR) {
  const limite = plusJours(jour, jours)
  return sessions
    .filter(s => s.fin >= jour && s.debut <= limite)
    .sort((a, b) => a.debut.localeCompare(b.debut))
}

/**
 * Pastille d'une fiche de session : « Prête » ou « N choses à faire ».
 * `aFaire` = cases non cochées de la liste ; inconnu tant que la liste
 * n'existe pas (pas de pastille inventée).
 */
export function pastilleSession({ aFaire }) {
  if (aFaire == null) return null
  if (aFaire === 0) return { cls: 'done', key: 'session_ready' }
  return { cls: 'alert', key: 'session_todo', n: aFaire }
}

// cfao-planning n'expose pas encore les sessions datées (ni leurs inscrits,
// ni la liste à cocher) : `sessions: null` affiche la section en construction.
// Les chiffres du hero restent à `null` (« — ») tant qu'aucune donnée n'existe.
const SOURCES = {
  values: { sessions: null, notifications: [], aPreparer: null, sansVoyage: null, invitationsAEnvoyer: null },
  loading: false,
}

/** Données du portail de l'assistante. */
export function useAssistantSources() {
  return SOURCES
}
