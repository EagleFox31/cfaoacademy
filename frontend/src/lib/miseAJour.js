/**
 * « Une nouvelle version est disponible » : détection et actualisation sans perte.
 *
 * Contrat commun des modules (portail, cr, needs, planning, medacap) :
 * GET <préfixe>/version.json → { module, version, build, critical?, min_client?, notes_key? },
 * servi sans cache, écrit au build. Tout échec de lecture = silence.
 *
 * Un écran qui a une saisie en cours s'inscrit avec registerBeforeReload (ce qu'il
 * faut garder) et registerAfterReload (comment le remettre) : « Actualiser » garde
 * ces données le temps du rechargement, dans l'onglet seulement (sessionStorage).
 */

const CLE_ETAT = 'cfao.maj-etat'
const CLE_PLUS_TARD = 'cfao.maj-plus-tard'

/** « Plus tard » : pas de rappel avant 30 min (ou avant la prochaine ouverture). */
export const RAPPEL_MS = 30 * 60_000
/** Lecture périodique de version.json (contrat : entre 5 et 30 min). */
export const INTERVALLE_MS = 10 * 60_000
/** Retour sur l'onglet : pas plus d'une lecture par minute. */
export const ECART_MIN_MS = 60_000

/** Version de ce code, posée au build (vite.config.js). */
export const VERSION_LOCALE = {
  module: 'portail',
  version: typeof __CFAO_VERSION__ === 'string' ? __CFAO_VERSION__ : '',
  // Jeton remplacé après minification (vite.config.js, renderChunk) : aucun test dessus
  // ici, le minifieur l'évaluerait avant le remplacement. Hors build, le jeton reste
  // et le serveur de dev n'a pas de version.json : lecture en échec, donc silence.
  build: typeof __CFAO_BUILD__ === 'string' ? __CFAO_BUILD__ : '',
}

const sauvegardes = new Map()

function session() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function lire(cle) {
  try {
    const brut = session()?.getItem(cle)
    return brut ? JSON.parse(brut) : null
  } catch {
    return null
  }
}

function ecrire(cle, valeur) {
  try {
    const s = session()
    if (!s) return
    if (valeur === null) s.removeItem(cle)
    else s.setItem(cle, JSON.stringify(valeur))
  } catch { /* stockage plein ou interdit : on recharge quand même */ }
}

/**
 * Inscrit ce qu'il faut garder avant une actualisation. `sauver()` renvoie des données
 * sérialisables en JSON (undefined = rien à garder). Renvoie la fonction de désinscription.
 */
export function registerBeforeReload(nom, sauver) {
  sauvegardes.set(nom, sauver)
  return () => {
    if (sauvegardes.get(nom) === sauver) sauvegardes.delete(nom)
  }
}

/**
 * Remet ce qui a été gardé sous `nom` avant l'actualisation, s'il y en a :
 * `restaurer(donnees)` est appelé une seule fois, puis les données sont effacées.
 */
export function registerAfterReload(nom, restaurer) {
  const etat = lire(CLE_ETAT)
  if (!etat || !Object.prototype.hasOwnProperty.call(etat, nom)) return
  const donnees = etat[nom]
  delete etat[nom]
  ecrire(CLE_ETAT, Object.keys(etat).length ? etat : null)
  try {
    restaurer(donnees)
  } catch { /* un écran qui échoue à restaurer ne bloque pas les autres */ }
}

/** Garde les saisies inscrites, puis recharge la page. */
export function actualiser({ recharger = () => window.location.reload() } = {}) {
  const etat = {}
  for (const [nom, sauver] of sauvegardes) {
    try {
      const donnees = sauver()
      if (donnees !== undefined) etat[nom] = donnees
    } catch { /* on garde ce qui peut l'être */ }
  }
  if (Object.keys(etat).length) ecrire(CLE_ETAT, etat)
  recharger()
}

/** Compare deux versions « x.y.z » (préfixe v accepté) ; null si l'une n'est pas lisible. */
export function comparerVersions(a, b) {
  const lireVersion = (v) => {
    const m = /^v?(\d+(?:\.\d+)*)/i.exec(String(v ?? '').trim())
    return m ? m[1].split('.').map(Number) : null
  }
  const x = lireVersion(a)
  const y = lireVersion(b)
  if (!x || !y) return null
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return Math.sign(d)
  }
  return 0
}

/**
 * Ce que dit version.json pour ce code : null si rien à proposer, sinon
 * { build, version, critique, notesKey }. critique = actualisation sans « Plus tard ».
 */
export function evaluer(distant, locale = VERSION_LOCALE) {
  if (!distant || typeof distant !== 'object' || !locale?.build) return null
  const build = distant.build == null ? '' : String(distant.build)
  if (!build || build === String(locale.build)) return null
  if (distant.module && locale.module && distant.module !== locale.module) return null
  const sousMinimum = distant.min_client != null
    && comparerVersions(locale.version, distant.min_client) === -1
  return {
    build,
    version: typeof distant.version === 'string' ? distant.version : '',
    critique: distant.critical === true || sousMinimum,
    notesKey: typeof distant.notes_key === 'string' ? distant.notes_key : '',
  }
}

/** Lit version.json ; null au moindre échec (réseau, 404, page HTML à la place du JSON). */
export async function lireVersionEnLigne(url, faireFetch = globalThis.fetch) {
  try {
    const r = await faireFetch(`${url}?t=${Date.now()}`, { cache: 'no-store', credentials: 'omit' })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

/*
 * Offre en cours, partagée entre la barre et le menu du compte : le menu la montre
 * tant qu'elle existe, même après « Plus tard » (qui ne fait taire que la barre).
 */
let offreCourante = null
const abonnes = new Set()

export function publierOffre(offre) {
  offreCourante = offre ?? null
  abonnes.forEach((f) => f())
}
export function lireOffre() {
  return offreCourante
}
export function abonnerOffre(f) {
  abonnes.add(f)
  return () => abonnes.delete(f)
}

/**
 * Lit version.json et publie le résultat. Renvoie 'disponible', 'a-jour' ou 'echec'
 * (lecture impossible : l'offre déjà connue est gardée).
 */
export async function rechercherMiseAJour({ url = '/version.json', locale = VERSION_LOCALE, faireFetch } = {}) {
  const distant = await lireVersionEnLigne(url, faireFetch)
  if (!distant || typeof distant !== 'object') return 'echec'
  const offre = evaluer(distant, locale)
  publierOffre(offre)
  return offre ? 'disponible' : 'a-jour'
}

export function reporter(maintenant = Date.now()) {
  ecrire(CLE_PLUS_TARD, { jusqua: maintenant + RAPPEL_MS })
}

export function estReporte(maintenant = Date.now()) {
  const p = lire(CLE_PLUS_TARD)
  return Boolean(p && typeof p.jusqua === 'number' && maintenant < p.jusqua)
}
