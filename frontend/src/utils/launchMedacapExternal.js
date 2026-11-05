import {
  MEDACAP_API_BASE_URL,
  MEDACAP_BASE_URL,
  medacapDefineLaunchBaseUrl,
  medacapLaunchBaseUrl,
} from './medacapConfig.js'

function medacapAllowedBases() {
  return [
    medacapLaunchBaseUrl(),
    medacapDefineLaunchBaseUrl(),
    MEDACAP_BASE_URL,
    MEDACAP_API_BASE_URL,
  ]
    .filter(Boolean)
    .map((base) => base.replace(/\/$/, ''))
}

/** Autorise uniquement les URLs MEDACAP connues (évite open redirect). */
export function isAllowedMedacapLaunchUrl(raw) {
  if (!raw) return false
  try {
    const url = new URL(raw, window.location.origin)
    const href = url.href.split('#')[0].replace(/\/$/, '')
    if (medacapAllowedBases().some((base) => href.startsWith(base))) return true
    if (import.meta.env.DEV && /\/medacap(\/|$)/i.test(url.pathname)) return true
    return false
  } catch {
    return false
  }
}

function medacapLaunchBridgeUrl(targetUrl) {
  const params = new URLSearchParams({ to: targetUrl })
  return `${window.location.origin}/portail/medacap-launch?${params}`
}

/**
 * Ouvre MEDACAP dans l’onglet courant via la page pont (loader puis redirection).
 */
export function launchMedacapExternal(url) {
  if (!url || !isAllowedMedacapLaunchUrl(url)) return

  window.location.assign(medacapLaunchBridgeUrl(url))
}
