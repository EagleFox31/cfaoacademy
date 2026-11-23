/**
 * Aperçu du portail d'un profil, pour le super admin.
 *
 * Le super admin ouvre, dans une fenêtre à part, le portail tel qu'il
 * s'affiche pour un rôle. Seul l'écran change : le jeton reste le sien et
 * chaque appel d'API reste contrôlé par Cerbos avec ses propres droits.
 * La fenêtre d'aperçu n'écrit rien : toute requête autre qu'une lecture y est
 * refusée avant de partir (sauf le renouvellement du jeton).
 *
 * Le rôle d'aperçu vit dans le sessionStorage de la fenêtre : il suit la
 * navigation dans cette fenêtre et ne touche pas la fenêtre principale.
 */
import { ROLE_PRIORITY } from '../pages/portal/portalProfiles.js'

export const CLE_APERCU = 'cfao_apercu_role'
const PARAM = 'apercu'
const AUTORISES = new Set(['superadmin'])

/** Un portail par rôle, dans l'ordre de la hiérarchie, apprenant en dernier. */
export const ROLES_APERCU = [
  ...ROLE_PRIORITY.filter(r => r !== 'superadmin' && r !== 'build_team'),
  'learner',
]

/**
 * Aperçus ouverts à un autre profil que le super admin : profil → portails
 * qu'il peut regarder. Le directeur du centre voit ceux de son équipe, dont
 * ses droits couvrent déjà les données.
 */
const APERCUS_DU_PROFIL = { center_director: ['training_coordinator', 'center_assistant'] }

/**
 * Sans `role` : droit d'ouvrir tous les aperçus (super admin). Avec `role` :
 * droit d'ouvrir l'aperçu de ce portail-là.
 */
export function peutOuvrirApercu(roles = [], role = null) {
  const tenus = roles ?? []
  if (tenus.some(r => AUTORISES.has(r))) return true
  return role !== null && tenus.some(r => APERCUS_DU_PROFIL[r]?.includes(role))
}

function roleValide(role) {
  return ROLES_APERCU.includes(role) ? role : null
}

/**
 * Rôle d'aperçu de cette fenêtre : le paramètre `?apercu=` (retenu pour la
 * suite de la navigation), sinon celui déjà retenu. Null hors aperçu.
 */
export function lireApercu(loc = globalThis.location, stockage = globalThis.sessionStorage) {
  try {
    const demande = new URLSearchParams(loc?.search ?? '').get(PARAM)
    if (demande !== null) {
      const role = roleValide(demande)
      if (role) stockage?.setItem(CLE_APERCU, role)
      else stockage?.removeItem(CLE_APERCU)
      return role
    }
    return roleValide(stockage?.getItem(CLE_APERCU))
  } catch {
    return null
  }
}

/**
 * « Vu comme » : compte réel dont l'aperçu montre les données (identifiant du
 * compte core). Même règle que le rôle : `?cible=` retenu pour la fenêtre,
 * et une valeur qui n'est pas un identifiant annule. C'est core qui décide
 * (droit du super admin, compte actif) ; ici on ne fait que transmettre.
 */
export const CLE_CIBLE = 'cfao_apercu_cible'
export const EN_TETE_VU_COMME = 'X-Cfao-Vu-Comme'
const PARAM_CIBLE = 'cible'
const IDENTIFIANT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function lireCible(loc = globalThis.location, stockage = globalThis.sessionStorage) {
  try {
    const demande = new URLSearchParams(loc?.search ?? '').get(PARAM_CIBLE)
    if (demande !== null || new URLSearchParams(loc?.search ?? '').has(PARAM)) {
      const cible = IDENTIFIANT.test(demande ?? '') ? demande.toLowerCase() : null
      if (cible) stockage?.setItem(CLE_CIBLE, cible)
      else stockage?.removeItem(CLE_CIBLE)
      return cible
    }
    const retenue = stockage?.getItem(CLE_CIBLE) ?? ''
    return IDENTIFIANT.test(retenue) ? retenue : null
  } catch {
    return null
  }
}

/**
 * Nom du compte cible, pour le bandeau. Il ne passe jamais par l'adresse
 * (journaux) : la fenêtre principale le pose dans son sessionStorage juste
 * le temps d'ouvrir la fenêtre, qui en reçoit une copie.
 */
export const CLE_NOM_CIBLE = 'cfao_apercu_cible_nom'

/**
 * Comptes proposés au « vu comme » : ceux qui ont un portail d'aperçu. Le
 * portail ouvert est celui de leur rôle le plus haut (ordre de ROLES_APERCU).
 */
export function comptesApercu(comptes = []) {
  return (comptes ?? [])
    .map(c => {
      const role = ROLES_APERCU.find(r => (c?.roles ?? []).includes(r))
      const nom = `${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim() || c?.email || ''
      return role && IDENTIFIANT.test(String(c?.id ?? '')) && !(c.roles ?? []).includes('superadmin')
        ? { id: String(c.id).toLowerCase(), nom, role }
        : null
    })
    .filter(Boolean)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

/**
 * Compte réel ouvert par la carte d'un profil : le premier par nom parmi les
 * comptes qui ont ce rôle (super admins écartés). null s'il n'y en a aucun.
 */
export function compteDuRole(comptes = [], role) {
  return (comptes ?? [])
    .filter(c => {
      const roles = c?.roles ?? []
      return roles.includes(role) && !roles.includes('superadmin') && IDENTIFIANT.test(String(c?.id ?? ''))
    })
    .map(c => ({
      id: String(c.id).toLowerCase(),
      nom: `${c?.first_name ?? ''} ${c?.last_name ?? ''}`.trim() || c?.email || '',
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))[0] ?? null
}

export function lireNomCible(stockage = globalThis.sessionStorage) {
  try {
    return String(stockage?.getItem(CLE_NOM_CIBLE) ?? '').slice(0, 120) || null
  } catch {
    return null
  }
}

export function quitterApercu(stockage = globalThis.sessionStorage) {
  try {
    stockage?.removeItem(CLE_APERCU)
    stockage?.removeItem(CLE_CIBLE)
    stockage?.removeItem(CLE_NOM_CIBLE)
  } catch { /* stockage indisponible */ }
}

/** Le même compte, vu avec le seul rôle de l'aperçu. */
export function utilisateurApercu(user, role) {
  return { ...user, roles: [role], apercu: role }
}

/** Droits planning qui écrivent : en aperçu, ils tombent (l'aperçu ne fait que lire). */
const DROITS_ECRITURE = ['manage', 'freeze', 'edit', 'import']

/**
 * Droits de /planning/access vus dans un aperçu : ceux de la lecture seulement.
 * Le super admin ne prête pas ses droits d'écriture au portail qu'il regarde.
 */
export function accesLecture(access, apercu) {
  if (!apercu || !access) return access
  return { ...access, ...Object.fromEntries(DROITS_ECRITURE.map(d => [d, false])) }
}

export function urlApercu(role, cible = null) {
  const suite = cible ? `&${PARAM_CIBLE}=${encodeURIComponent(cible)}` : ''
  return `/portail?${PARAM}=${encodeURIComponent(role)}${suite}`
}

/**
 * Nouvelle fenêtre (pas un onglet : `popup`), une par rôle (et par compte en
 * « vu comme »), réutilisée si elle est déjà ouverte. Sans `noopener` : la
 * fenêtre reçoit une copie du sessionStorage, donc la session en cours, sans
 * nouvelle connexion.
 */
export function ouvrirApercu(role, win = globalThis.window, cible = null, nomCible = '') {
  const largeur = Math.min(1440, win.screen?.availWidth ?? 1440)
  const hauteur = Math.min(900, win.screen?.availHeight ?? 900)
  const nom = cible ? `apercu-${role}-${cible}` : `apercu-${role}`
  const stockage = win.sessionStorage
  try {
    if (cible && nomCible) stockage?.setItem(CLE_NOM_CIBLE, nomCible)
    else stockage?.removeItem(CLE_NOM_CIBLE)
  } catch { /* stockage indisponible : bandeau sans nom */ }
  const fenetre = win.open(urlApercu(role, cible), nom,
    `popup=yes,width=${largeur},height=${hauteur}`)
  try { stockage?.removeItem(CLE_NOM_CIBLE) } catch { /* idem */ }
  fenetre?.focus?.()
  return fenetre
}

const LECTURES = new Set(['GET', 'HEAD', 'OPTIONS'])

function methodeDe(entree, options) {
  return String(options?.method ?? entree?.method ?? 'GET').toUpperCase()
}

function urlDe(entree) {
  return typeof entree === 'string' ? entree : (entree?.url ?? String(entree))
}

/** Une API de la plateforme, sur la même adresse que le portail. */
function versNosApi(entree, win) {
  try {
    const base = win.location?.href ?? 'http://localhost/'
    const url = new URL(urlDe(entree), base)
    return url.origin === new URL(base).origin && url.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

/** Même requête, avec l'en-tête « vu comme » en plus de ses propres en-têtes. */
function avecCible(entree, options, cible) {
  const entetes = new Headers(options?.headers ?? (entree instanceof Request ? entree.headers : undefined))
  entetes.set(EN_TETE_VU_COMME, cible)
  return { ...options, headers: entetes }
}

/**
 * Refuse, dans cette fenêtre, toute requête qui écrit. Le renouvellement du
 * jeton (`/protocol/openid-connect/token`) passe : sans lui, l'aperçu se
 * déconnecterait. Avec une cible (« vu comme »), les lectures de nos API
 * (GET, HEAD) portent l'en-tête ; rien d'autre ne le porte (ni Keycloak, ni
 * une autre adresse). Renvoie la fonction qui rend le fetch d'origine.
 */
export function verrouillerEcritures(win = globalThis.window, cible = null) {
  const origine = win.fetch
  if (!origine || origine.apercu) return () => {}
  const garde = (entree, options) => {
    const methode = methodeDe(entree, options)
    if (cible && (methode === 'GET' || methode === 'HEAD') && versNosApi(entree, win)) {
      return origine.call(win, entree, avecCible(entree, options, cible))
    }
    if (LECTURES.has(methode) || urlDe(entree).includes('/protocol/openid-connect/token')) {
      return origine.call(win, entree, options)
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: 'apercu_lecture_seule' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }))
  }
  garde.apercu = true
  win.fetch = garde
  return () => { win.fetch = origine }
}
