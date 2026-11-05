import {
  MEDACAP_BRIDGE_KEY,
  medacapDefineLaunchBaseUrl,
  resolveMedacapUserQuery,
} from './medacapConfig.js'
import { PIF_SCOPE_PLURI } from './learnerPif.js'

function defineBaseUrl() {
  return medacapDefineLaunchBaseUrl()
}

export function medacapDefinePluriDashboardUrl() {
  return `${defineBaseUrl()}/views/define/dashboard.php`
}

export function medacapDefineAnnualDashboardUrl() {
  return `${defineBaseUrl()}/views/define/dashboard2026.php`
}

/** Vue DPS — dashboard technicien avec filtres agence / collaborateur. */
export function medacapDefineCollaboratorDashboardUrl() {
  return `${defineBaseUrl()}/views/define/collaboratorDashboard`
}

/** @deprecated Préférer medacapDefinePluriDashboardUrl() */
export const MEDACAP_DEFINE_PLURI_PATH = medacapDefinePluriDashboardUrl()

/** @deprecated Préférer medacapDefineAnnualDashboardUrl() */
export const MEDACAP_DEFINE_ANNUAL_PATH = medacapDefineAnnualDashboardUrl()

/** Slugs portail → libellé marque attendu par FilterController Define (`brandJunior`, etc.). */
const SLUG_TO_MEDACAP_BRAND = {
  'renault-trucks': 'RENAULT TRUCK',
  'king-long': 'KING LONG',
  'toyota-forklift': 'TOYOTA FORKLIFT',
  bt: 'TOYOTA BT',
  hino: 'HINO',
  sinotruk: 'SINOTRUK',
  fuso: 'FUSO',
  jcb: 'JCB',
  lovol: 'LOVOL',
  shacman: 'SHACMAN',
  toyota: 'TOYOTA',
  suzuki: 'SUZUKI',
  yamaha: 'YAMAHA',
  byd: 'BYD',
  mitsubishi: 'MITSUBISHI',
  'mercedes-benz': 'MERCEDES',
  stellantis: 'STELLANTIS',
}

export function resolveMedacapBrandQueryParam(brandSlug) {
  if (!brandSlug) return null
  if (SLUG_TO_MEDACAP_BRAND[brandSlug]) return SLUG_TO_MEDACAP_BRAND[brandSlug]
  return String(brandSlug).toUpperCase().replace(/-/g, ' ')
}

const MEDACAP_OBJECT_ID = /^[a-f0-9]{24}$/i

function resolveEmbedReturnUrl(explicit) {
  if (explicit) return String(explicit)
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href
  }
  return null
}

/** `_id` Mongo du technicien — requis pour la vue Define « en tant que technicien ». */
export function resolveMedacapTechnicianId(technician) {
  if (!technician) return null
  for (const key of ['medacapUserId', 'id']) {
    const value = technician[key]
    if (value && MEDACAP_OBJECT_ID.test(String(value))) return String(value)
  }
  return null
}

/**
 * SSO portail → session PHP → dashboard Define.
 * @param {{ view?: 'pluri'|'annual', brand?: string, scope?: string|number, technicianId?: string, technicianUsername?: string, viewAs?: 'technician' }} options
 */
export function resolveMedacapDefineLaunchUrl(user, options = {}) {
  const { brand, technicianId, technicianUsername, viewAs } = options
  const view = options.view ?? 'pluri'

  const query = resolveMedacapUserQuery(user)
  const brandParam = resolveMedacapBrandQueryParam(brand)
  const base = defineBaseUrl()

  const params = {
    key: MEDACAP_BRIDGE_KEY,
    view,
    ...(query ?? {}),
    ...(brandParam ? { brand: brandParam } : {}),
    ...(technicianId ? { technicianId } : {}),
    ...(technicianUsername ? { technicianUsername } : {}),
    ...(viewAs ? { viewAs } : {}),
  }

  if (!query) {
    const direct = view === 'annual'
      ? medacapDefineAnnualDashboardUrl()
      : medacapDefinePluriDashboardUrl()
    const qs = new URLSearchParams()
    if (brandParam) qs.set('brand', brandParam)
    if (technicianId) qs.set('technicianId', technicianId)
    if (technicianUsername) qs.set('technicianUsername', technicianUsername)
    if (viewAs) qs.set('viewAs', viewAs)
    const suffix = qs.toString()
    return suffix ? `${direct}?${suffix}` : direct
  }

  return `${base}/views/measure/api/portal-launch-define.php?${new URLSearchParams(params)}`
}

/**
 * URL directe collaboratorDashboard (session MEDACAP DPS déjà ouverte).
 * Ex. …/collaboratorDashboard?agency=Douala&technicianId=…&level=all&brand=all
 */
export function resolveMedacapCollaboratorDashboardUrl(technician, options = {}) {
  const technicianId = resolveMedacapTechnicianId(technician)
  if (!technicianId) return null

  const params = new URLSearchParams()
  if (technician?.agency) params.set('agency', String(technician.agency))
  params.set('technicianId', technicianId)
  params.set('level', options.level ?? 'all')
  params.set('brand', options.brand ?? 'all')
  params.set('embed', '1')
  params.set('scope', options.scope ?? 'pluri')
  const returnUrl = resolveEmbedReturnUrl(options.returnUrl)
  if (returnUrl) params.set('returnUrl', returnUrl)

  return `${medacapDefineCollaboratorDashboardUrl()}?${params}`
}

/**
 * Portail DPS → SSO session Define → collaboratorDashboard du technicien cliqué.
 */
export function resolveMedacapCollaboratorDashboardLaunchUrl(dpsUser, technician, options = {}) {
  const direct = resolveMedacapCollaboratorDashboardUrl(technician, options)
  const query = resolveMedacapUserQuery(dpsUser)
  if (!query) return direct

  const technicianId = resolveMedacapTechnicianId(technician)
  const technicianUsername = technician?.username ?? technician?.medacapUsername ?? null
  const returnUrl = resolveEmbedReturnUrl(options.returnUrl)

  const params = {
    key: MEDACAP_BRIDGE_KEY,
    view: 'collaborator',
    target: 'collaboratorDashboard',
    ...query,
    level: options.level ?? 'all',
    brand: options.brand ?? 'all',
    embed: '1',
    scope: options.scope ?? 'pluri',
    ...(returnUrl ? { returnUrl } : {}),
    ...(technician?.agency ? { agency: String(technician.agency) } : {}),
    ...(technicianId ? { technicianId } : {}),
    ...(!technicianId && technicianUsername ? { technicianUsername } : {}),
  }

  return `${defineBaseUrl()}/views/measure/api/portal-launch-define.php?${new URLSearchParams(params)}`
}

/**
 * @deprecated Préférer resolveMedacapCollaboratorDashboardLaunchUrl()
 */
export function resolveMedacapDefineTechnicianViewUrl(dpsUser, technician, options = {}) {
  return resolveMedacapCollaboratorDashboardLaunchUrl(dpsUser, technician, options)
}

/** PIF filiale DPS — ouvre toujours le pluriannuel Define (vue annuelle pas encore généralisée). */
export function resolveMedacapDefinePifLaunchUrl(user, { brand, scope = PIF_SCOPE_PLURI } = {}) {
  return resolveMedacapDefineLaunchUrl(user, {
    view: 'pluri',
    brand,
    scope,
  })
}

export function isDpsPifAnnualScope(scope) {
  return scope != null && scope !== PIF_SCOPE_PLURI
}
