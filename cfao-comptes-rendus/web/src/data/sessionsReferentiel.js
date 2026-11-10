/**
 * D'ou viennent les sessions du formateur.
 *
 * Referentiel des formations non vide : les sessions de l'API
 * (`/cr-donnees/sessions`), seules a pouvoir etre documentees. Referentiel
 * vide, ou service qui ne repond pas (mode d'essai) : le comportement
 * d'avant est conserve, avec les sessions d'essai et la saisie manuelle.
 *
 * Ce module est le seul a decider de la source ; les ecrans n'appellent
 * plus `sessionsDuFormateur` directement.
 */
import { adresse } from '../lib/adresse'
import { sessionsDuFormateur } from './mock_sessions_formateur'

const ETAT = adresse('/cr-donnees/referentiel/etat')
const SESSIONS = adresse('/cr-donnees/sessions')

export const SOURCE_API = 'api'
export const SOURCE_ESSAI = 'essai'

/** Aucun filtre : toutes les sessions que le formateur peut lire. */
export const FILTRES_VIDES = { q: '', mois: '', pays: '', marque: '', formateur: '' }

/** La source des sessions d'apres l'etat du referentiel (`null` : service muet). */
export function choisirSource(etat) {
  return etat && etat.vide === false ? SOURCE_API : SOURCE_ESSAI
}

/** L'adresse de la liste, avec les seuls filtres renseignes. */
export function adresseSessions(filtres = {}) {
  const params = new URLSearchParams()
  for (const cle of Object.keys(FILTRES_VIDES)) {
    const valeur = String(filtres?.[cle] ?? '').trim()
    if (valeur) params.set(cle, valeur)
  }
  const texte = params.toString()
  return texte ? `${SESSIONS}?${texte}` : SESSIONS
}

/** Le motif d'un refus ou d'une panne, dit comme le formateur le lit. */
export function messageDErreur(statut) {
  if (statut === 401) return 'Votre session a expiré : reconnectez-vous.'
  if (statut === 403) return 'Vous n’avez pas accès à ces sessions.'
  if (statut === 404) return 'Cette session n’existe pas ou plus.'
  if (statut === 400) return 'Les filtres choisis ne sont pas valides.'
  return 'Le service des sessions ne répond pas. Réessayez dans un instant.'
}

export class ErreurSessions extends Error {
  constructor(statut) {
    super(messageDErreur(statut))
    this.name = 'ErreurSessions'
    this.statut = statut
  }
}

// Un appel identique deja parti n'est pas relance : l'accueil, la barre du
// haut et l'assistant demandent la meme liste au meme instant.
const enVol = new Map()
function unSeulAppel(url, produire) {
  if (!enVol.has(url)) {
    enVol.set(url, produire().finally(() => enVol.delete(url)))
  }
  return enVol.get(url)
}

async function obtenir(url) {
  const controle = new AbortController()
  const minuterie = setTimeout(() => controle.abort(), 8000)
  try {
    return await fetch(url, { credentials: 'same-origin', signal: controle.signal })
  } finally {
    clearTimeout(minuterie)
  }
}

/** `{ vide }` quand le service repond ; `null` sinon (mode d'essai). */
export function chargerEtat() {
  return unSeulAppel(ETAT, async () => {
    try {
      const r = await obtenir(ETAT)
      if (!r.ok) return null
      const etat = await r.json()
      return typeof etat?.vide === 'boolean' ? etat : null
    } catch {
      return null
    }
  })
}

async function lireJson(url) {
  let r
  try {
    r = await obtenir(url)
  } catch {
    throw new ErreurSessions(0)
  }
  if (!r.ok) throw new ErreurSessions(r.status)
  try {
    return await r.json()
  } catch {
    throw new ErreurSessions(0)
  }
}

/**
 * Les sessions du formateur : `{ source, sessions }`.
 *
 * En mode d'essai les filtres ne s'appliquent pas (la liste tient en
 * quelques lignes). Une panne du service, referentiel renseigne, leve
 * une `ErreurSessions` : on ne retombe pas sur les sessions d'essai.
 */
export async function chargerSessions(filtres = {}, user = null) {
  const source = choisirSource(await chargerEtat())
  if (source === SOURCE_ESSAI) return { source, sessions: sessionsDuFormateur(user) }
  const url = adresseSessions(filtres)
  const corps = await unSeulAppel(url, () => lireJson(url))
  return { source, sessions: Array.isArray(corps?.sessions) ? corps.sessions : [] }
}

/** Une session du referentiel, par son identifiant ; `null` si elle n'existe pas. */
export async function chargerSession(id) {
  const url = `${SESSIONS}/${encodeURIComponent(id)}`
  try {
    return await unSeulAppel(url, () => lireJson(url))
  } catch (e) {
    if (e?.statut === 404) return null
    throw e
  }
}

/**
 * Retrouve une session par son identifiant, pour rouvrir un compte rendu
 * depuis un lien : le referentiel pour un identifiant numerique, la
 * source courante sinon. `null` si elle n'existe pas.
 */
export async function trouverSession(id, user = null) {
  if (/^\d+$/.test(String(id))) return chargerSession(id)
  const { sessions } = await chargerSessions({}, user)
  return sessions.find(s => String(s.id) === String(id)) || null
}
