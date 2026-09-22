/**
 * Conservation locale des comptes rendus en cours.
 *
 * Une session se documente rarement d'un trait : le formateur saisit
 * les notes le vendredi, ajoute les photos le lundi. Le brouillon
 * survit donc a la fermeture de l'onglet.
 *
 * Le stockage peut echouer — navigation privee, quota plein. Chaque
 * acces est garde : un brouillon perdu est un desagrement, une page
 * blanche est une panne.
 */
const CLE = 'cfao.comptes-rendus'

function lire() {
  try {
    const brut = localStorage.getItem(CLE)
    return brut ? JSON.parse(brut) : {}
  } catch {
    return {}
  }
}

function ecrire(tout) {
  try {
    localStorage.setItem(CLE, JSON.stringify(tout))
    return true
  } catch {
    return false
  }
}

/** Enregistre un brouillon sous son identifiant de session. */
export function enregistrer(id, brouillon) {
  if (!id) return false
  const tout = lire()
  tout[id] = { ...brouillon, modifieLe: new Date().toISOString() }
  return ecrire(tout)
}

/** Le brouillon d'une session, ou `null`. */
export function recuperer(id) {
  return lire()[id] || null
}

/** Efface un brouillon — apres production du rapport, par exemple. */
export function oublier(id) {
  const tout = lire()
  delete tout[id]
  ecrire(tout)
}

/** Les brouillons en cours, du plus recent au plus ancien. */
export function brouillonsEnregistres() {
  const tout = lire()
  return Object.entries(tout)
    .map(([id, b]) => ({
      id,
      session: b.intitule || b.sessionId || null,
      modifieLe: b.modifieLe,
      phase: b.phase ?? 0,
    }))
    .sort((a, b) => String(b.modifieLe).localeCompare(String(a.modifieLe)))
}
