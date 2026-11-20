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

export function peutOuvrirApercu(roles = []) {
  return (roles ?? []).some(r => AUTORISES.has(r))
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

export function quitterApercu(stockage = globalThis.sessionStorage) {
  try { stockage?.removeItem(CLE_APERCU) } catch { /* stockage indisponible */ }
}

/** Le même compte, vu avec le seul rôle de l'aperçu. */
export function utilisateurApercu(user, role) {
  return { ...user, roles: [role], apercu: role }
}

export function urlApercu(role) {
  return `/portail?${PARAM}=${encodeURIComponent(role)}`
}

/**
 * Nouvelle fenêtre (pas un onglet : `popup`), une par rôle, réutilisée si
 * elle est déjà ouverte. Sans `noopener` : la fenêtre reçoit une copie du
 * sessionStorage, donc la session en cours, sans nouvelle connexion.
 */
export function ouvrirApercu(role, win = globalThis.window) {
  const largeur = Math.min(1440, win.screen?.availWidth ?? 1440)
  const hauteur = Math.min(900, win.screen?.availHeight ?? 900)
  const fenetre = win.open(urlApercu(role), `apercu-${role}`,
    `popup=yes,width=${largeur},height=${hauteur}`)
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

/**
 * Refuse, dans cette fenêtre, toute requête qui écrit. Le renouvellement du
 * jeton (`/protocol/openid-connect/token`) passe : sans lui, l'aperçu se
 * déconnecterait. Renvoie la fonction qui rend le fetch d'origine.
 */
export function verrouillerEcritures(win = globalThis.window) {
  const origine = win.fetch
  if (!origine || origine.apercu) return () => {}
  const garde = (entree, options) => {
    const methode = methodeDe(entree, options)
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
