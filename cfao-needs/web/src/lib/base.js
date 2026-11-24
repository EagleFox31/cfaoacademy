/**
 * Préfixe sous lequel l'application est servie (`base` de vite.config.js, ex. « /besoins/ »).
 *
 * Une seule adresse pour toutes les applications (PLAN-chemins-edge.md) : jamais de
 * chemin absolu « /… » en dur, toujours `asset()` pour un fichier et `cheminApp()`
 * pour la route vue par le routeur.
 */
export const BASE = import.meta.env.BASE_URL || '/'

/** Préfixe sans la barre finale (« /besoins », ou « » à la racine) : basename du routeur. */
export const BASENAME = BASE.replace(/\/$/, '')

/** URL d'un fichier public (« assets/x.png » ou « /assets/x.png ») sous le préfixe. */
export function asset(path) {
  return `${BASE}${String(path).replace(/^\/+/, '')}`
}

/** Route de l'application, sans le préfixe (« /besoins/relecture » → « /relecture »). */
export function cheminApp(pathname = window.location.pathname) {
  if (BASENAME && (pathname === BASENAME || pathname.startsWith(`${BASENAME}/`))) {
    return pathname.slice(BASENAME.length) || '/'
  }
  return pathname
}

/** Adresse absolue d'une route de l'application (redirections OIDC, déconnexion). */
export function urlApp(route = '/') {
  return `${window.location.origin}${BASENAME}${route.startsWith('/') ? route : `/${route}`}`
}
