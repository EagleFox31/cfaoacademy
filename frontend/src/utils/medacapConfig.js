/** URL MEDACAP pour lancer les QCM (portal-launch, quiz). */
export const MEDACAP_BASE_URL = (import.meta.env.VITE_MEDACAP_URL ?? '').replace(/\/$/, '')

/** URL optionnelle pour lire l’API (dev local WAMP → Mongo entreprise). */
export const MEDACAP_API_BASE_URL = (
  import.meta.env.VITE_MEDACAP_API_URL ?? MEDACAP_BASE_URL
).replace(/\/$/, '')

/** Clé partagée portail ↔ api/portal-launch.php & evaluations.php */
export const MEDACAP_BRIDGE_KEY = import.meta.env.VITE_MEDACAP_BRIDGE_KEY ?? 'demo-cfao-portal'

const DEV_PROXY_TARGET = import.meta.env.VITE_MEDACAP_PROXY ?? 'http://localhost/medacap'

export function isMedacapEnabled() {
  return Boolean(MEDACAP_API_BASE_URL) || import.meta.env.DEV
}

/** Chemin API evaluations (lecture liste tests). */
export function medacapApiUrl(path, params = {}) {
  const qs = new URLSearchParams({ key: MEDACAP_BRIDGE_KEY, ...params })
  if (import.meta.env.DEV && !MEDACAP_API_BASE_URL) {
    return `/medacap-api/views/measure/api/${path}?${qs}`
  }
  const base = MEDACAP_API_BASE_URL || `${DEV_PROXY_TARGET.replace(/\/medacap$/, '')}/medacap`
  return `${base}/views/measure/api/${path}?${qs}`
}

/** Base URL pour portal-launch (doit être le serveur où l’utilisateur passe le QCM). */
export function medacapLaunchBaseUrl() {
  return MEDACAP_BASE_URL || MEDACAP_API_BASE_URL || `${DEV_PROXY_TARGET.replace(/\/medacap$/, '')}/medacap`
}

/**
 * Base MEDACAP pour SSO Define (portal-launch-define → session → dashboard).
 * En dev split (API localhost, QCM 10.68.0.7), Define passe par le WAMP local :
 * portal-launch-define.php n’est pas déployé / fonctionnel sur 10.68.0.7.
 */
export function medacapDefineLaunchBaseUrl() {
  if (MEDACAP_API_BASE_URL && MEDACAP_BASE_URL && MEDACAP_API_BASE_URL !== MEDACAP_BASE_URL) {
    return MEDACAP_API_BASE_URL
  }
  return medacapLaunchBaseUrl()
}

/** Identifiant Mongo MEDACAP pour l'utilisateur mock. */
export function resolveMedacapUserQuery(user) {
  if (!user) return null
  if (user.medacapUserId) return { userId: user.medacapUserId }
  if (user.medacapUsername) return { username: user.medacapUsername }
  if (user.medacapEmail) return { email: user.medacapEmail }
  return null
}
