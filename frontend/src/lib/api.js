/**
 * Client API du portail — première brique du démockage.
 *
 * Un seul point de sortie vers `cfao-core`. Tant que les écrans lisent encore
 * `mock_lms.js`, ce fichier ne sert qu'à `/me` ; il grandira écran par écran.
 *
 * ── Intercepteur HTTP ───────────────────────────────────────────────────────────
 * Avant chaque requête, l'intercepteur vérifie si le token est en zone critique
 * (< 45 secondes avant expiration). Si oui, il attend la résolution du Silent
 * Refresh avant d'émettre la requête. En cas de 401, une tentative unique de
 * refresh + rejeu est effectuée. Si le refresh échoue, on déclenche la
 * réauthentification propre vers Keycloak (sans boucle infinie).
 */
import {
  ensureFreshToken,
  readSession,
  reauthenticate,
  refreshSession,
} from './auth'

function resolveApiBase() {
  const envBase = import.meta.env.VITE_API_URL || '/api/v1/core'
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return envBase
      .replace('//localhost:', `//${window.location.hostname}:`)
      .replace('//127.0.0.1:', `//${window.location.hostname}:`)
  }
  return envBase
}

const BASE = resolveApiBase()

export class ApiError extends Error {
  constructor(status, detail, payload = null) {
    super(detail || `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
    this.code = payload?.error?.code ?? null
  }
}

// ── Mise à jour en cours ─────────────────────────────────────────────────────
// cfao-edge répond 503 {"detail":"maintenance"} + Retry-After quand un module
// est arrêté (déploiement). Une lecture (GET) attend et réessaie seule, jusqu'à
// MAINTENANCE_MAX_MS ; une écriture n'est jamais rejouée (elle a pu passer).
// Les écrans s'abonnent à l'état pour afficher « Mise à jour en cours ».
export const MAINTENANCE_MAX_MS = 10 * 60 * 1000
const DEFAULT_RETRY_S = 15

let maintenance = false
const maintenanceListeners = new Set()

function setMaintenance(value) {
  if (maintenance === value) return
  maintenance = value
  maintenanceListeners.forEach(fn => fn(value))
}

export const isMaintenance = () => maintenance

export function subscribeMaintenance(fn) {
  maintenanceListeners.add(fn)
  return () => maintenanceListeners.delete(fn)
}

export const isMaintenanceError = err => err?.status === 503 && err?.code === 'maintenance'

function retryDelayMs(response) {
  const s = Number(response.headers.get('Retry-After'))
  return Math.min(Math.max(Number.isFinite(s) && s > 0 ? s : DEFAULT_RETRY_S, 5), 60) * 1000
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Émet une requête HTTP vers l'API avec gestion automatique du token.
 *
 * @param {string} path — chemin relatif à la base API (ex. '/me')
 * @param {object} options
 * @param {string} [options.method='GET']
 * @param {*} [options.body] — corps JSON (sérialisé automatiquement)
 * @param {boolean} [options._isRetry=false] — usage interne : empêche les boucles de retry
 */
async function request(path, opts = {}) {
  const { method = 'GET', body, form, blob = false, base = BASE, _isRetry = false, _waitingSince } = opts
  // ── Pré-contrôle : s'assurer d'un token frais avant d'émettre la requête ────
  const session = _isRetry ? readSession() : await ensureFreshToken()

  const init = {
    method,
    headers: {
      Accept: blob ? '*/*' : 'application/json',
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
  }
  if (body !== undefined) init.body = JSON.stringify(body)
  // multipart : le navigateur pose lui-même le Content-Type et sa frontière
  if (form !== undefined) init.body = form

  let response
  try {
    response = await fetch(`${base}${path}`, init)
  } catch {
    // Réseau coupé : à distinguer d'un refus serveur, sinon on affiche « accès
    // refusé » à quelqu'un qui a juste perdu sa connexion.
    throw new ApiError(0, 'network')
  }

  if (response.status === 503) {
    const detail = await response.clone().json().then(p => p?.detail, () => null)
    if (detail === 'maintenance') {
      const since = _waitingSince ?? Date.now()
      if (method === 'GET' && Date.now() - since < MAINTENANCE_MAX_MS) {
        setMaintenance(true)
        await sleep(retryDelayMs(response))
        return request(path, { ...opts, _isRetry: false, _waitingSince: since })
      }
      // Plus de reprise automatique : l'écran affiche l'erreur (bouton Réessayer).
      setMaintenance(false)
      throw new ApiError(503, 'maintenance', { error: { code: 'maintenance' } })
    }
  }
  setMaintenance(false)

  if (response.status === 204) return null
  if (blob && response.ok) return response.blob()
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    // ── 401 : session expirée côté serveur ───────────────────────────────
    // Tentative unique : refresh + rejeu de la requête. Si le refresh échoue,
    // réauthentification propre vers Keycloak. Pas de boucle infinie : le flag
    // `_isRetry` empêche un second passage.
    if (response.status === 401 && !_isRetry) {
      const refreshed = await refreshSession()
      if (refreshed) {
        // Rejeu unique avec le nouveau token
        return request(path, { ...opts, _isRetry: true })
      }
      // Refresh échoué : session SSO Keycloak expirée ou révoquée
      reauthenticate()
      throw new ApiError(401, 'session_expired')
    }

    // ── 401 en retry ou sans possibilité de refresh ─────────────────────
    if (response.status === 401) {
      reauthenticate()
      throw new ApiError(401, 'session_expired')
    }

    // ── 403 : accès refusé par Cerbos — PAS de redirection login ────────
    // L'utilisateur est bien authentifié, mais non habilité pour cette action.
    if (response.status === 403) {
      throw new ApiError(403, payload?.detail ?? 'Accès refusé', payload)
    }

    // Format d'erreur normalisé des modules : {error: {code, message, details}}
    throw new ApiError(response.status, payload?.error?.message ?? payload?.detail, payload)
  }
  return payload
}

/**
 * Client d'un autre module (même jeton, même gestion 401/403) :
 * `createClient('/api/v1/planning').get('/access')`.
 */
export function createClient(base) {
  const call = (method) => (path, opts = {}) => request(path, { ...opts, method, base })
  return { get: call('GET'), post: call('POST'), patch: call('PATCH'), del: call('DELETE') }
}

export const api = {
  /**
   * Le principal résolu côté serveur : rôles ET périmètre viennent de la base
   * `identity`, pas des claims du jeton. C'est la source qui fait autorité —
   * un jeton peut être en retard sur une réaffectation.
   */
  me: () => request('/me'),

  /**
   * KPIs consolidés groupe (module `analytics`). Réservé aux rôles groupe
   * (superadmin, group_admin, group_hr) — Cerbos gate côté API.
   *
   * @param {'all'|'equipment'|'motors'} [bu='all'] — filtre Business Unit.
   *   `learnerCount` et `brandCount` sont recalculés selon la BU ; `branchCount`
   *   et `trainingCount` restent globaux.
   * Retour : { bu, learnerCount, branchCount, brandCount, trainingCount, trainingYear, filiales[] }.
   */
  groupStats: (bu = 'all') => request(`/analytics/group-stats?bu=${encodeURIComponent(bu)}`),

  /**
   * Journal d'audit — la vue DRF filtre déjà par périmètre via query plan Cerbos.
   * Pour un super admin (scope groupe), tous les events sont visibles.
   * Retour paginé : { next, previous, results: AuditEvent[] }.
   */
  auditLogs: () => request('/audit/'),

  /**
   * Scope équipe du chef d'équipe connecté (ou d'un username donné pour demo).
   * Retour : { subsidiary, agencyName, technicianCount, brandCount,
   *            members[], brandMatrix[], kpis{}, manager{} }
   */
  managerScope: (username) =>
    request(`/manager/scope${username ? `?username=${encodeURIComponent(username)}` : ''}`),
}
