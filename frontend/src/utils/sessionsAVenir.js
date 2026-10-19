/**
 * Les sessions de formation que le formateur anime bientot.
 *
 * Le portail n'en a besoin que pour la navigation et le tableau de bord ;
 * le suivi des comptes rendus vit dans le module `cfao-comptes-rendus`.
 * Le statut du planning n'est pas toujours tenu a jour : la date de fin
 * fait foi.
 */

/** La date du jour, au format des sessions (AAAA-MM-JJ, heure locale). */
export function aujourdhui() {
  const d = new Date()
  const n = v => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${n(d.getMonth() + 1)}-${n(d.getDate())}`
}

export const sessionPassee = (s, jour = aujourdhui()) => Boolean(s.fin) && s.fin < jour

/** Sessions en cours ou a venir, pas encore terminees. */
export function sessionsAVenir(sessions, jour = aujourdhui()) {
  return sessions.filter(s => (s.statut === 'en_cours' || s.statut === 'a_venir')
    && !sessionPassee(s, jour))
}
