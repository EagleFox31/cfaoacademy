/**
 * Ce que le planning demande au formateur : les comptes rendus a
 * produire et les sessions de formation a venir.
 *
 * Une session est a documenter des que la formation est passee (ou que
 * le planning la dit « a rediger ») et tant que son compte rendu n'est
 * pas termine. Le statut du planning n'est pas toujours tenu a jour :
 * la date de fin fait foi.
 */
import { brouillonsEnCours } from './brouillonsCompteRendu.js'

/** La date du jour, au format des sessions (AAAA-MM-JJ, heure locale). */
export function aujourdhui() {
  const d = new Date()
  const n = v => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${n(d.getMonth() + 1)}-${n(d.getDate())}`
}

export const sessionPassee = (s, jour = aujourdhui()) => Boolean(s.fin) && s.fin < jour

/** Sessions dont le compte rendu est du. */
export function sessionsARediger(sessions, jour = aujourdhui()) {
  return sessions.filter(s => s.statut !== 'termine'
    && (s.statut === 'a_rediger' || sessionPassee(s, jour)))
}

/** Sessions en cours ou a venir, pas encore terminees. */
export function sessionsAVenir(sessions, jour = aujourdhui()) {
  return sessions.filter(s => (s.statut === 'en_cours' || s.statut === 'a_venir')
    && !sessionPassee(s, jour))
}

/**
 * Les comptes rendus a documenter : ceux a continuer (saisies commencees)
 * et ceux a commencer (sessions dues sans aucun brouillon, ni en cours ni
 * termine). Une session n'est jamais comptee deux fois.
 *
 * @param sessions   les sessions du formateur
 * @param brouillons la liste de `brouillonsEnregistres()`
 */
export function aDocumenter(sessions, brouillons, jour = aujourdhui()) {
  return {
    aContinuer: brouillonsEnCours(brouillons),
    aCommencer: sessionsARediger(sessions, jour)
      .filter(s => !brouillons.some(b => b.id === s.id)),
  }
}
