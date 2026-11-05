/** Client API — un seul point d'accès, un seul traitement d'erreur. */
import { readSession, reauthenticate } from './auth'

const BASE = (import.meta.env.VITE_API_BASE || '/api/v1/needs').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(status, detail, payload) {
    super(detail || `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.payload = payload
  }
}

async function request(path, { method = 'GET', body, headers, raw, keepalive } = {}) {
  const session = readSession()
  const init = {
    method,
    // `keepalive` : la requête survit à la destruction du document. Sans lui, un
    // envoi déclenché au rechargement de la page est annulé par le navigateur —
    // le filet de sécurité de sortie de page ne rattrapait donc rien.
    // Limite du standard : 64 Ko de corps cumulés, largement suffisant pour un
    // lot de lignes de saisie.
    ...(keepalive ? { keepalive: true } : {}),
    headers: {
      Accept: 'application/json',
      ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
  }
  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(`${BASE}${path}`, init)
  } catch {
    // Réseau coupé : distinguer ce cas d'un refus serveur, sinon on affiche
    // « accès refusé » à quelqu'un qui a juste perdu le wifi.
    throw new ApiError(0, 'network')
  }

  if (response.status === 204) return null
  if (raw) return response

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    // 401 = session expirée ou jeton refusé : reconduire à la connexion,
    // jamais un banner « Something went wrong » (norme UX auth SaaS).
    if (response.status === 401) {
      reauthenticate()
    }
    throw new ApiError(response.status, payload?.detail, payload)
  }
  return payload
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  raw: (path, options) => request(path, { ...options, raw: true }),

  // ── campagne ──────────────────────────────────────────────────────────────
  campaigns: () => request('/campaigns'),
  campaign: (id) => request(`/campaigns/${id}`),
  families: (id) => request(`/campaigns/${id}/families`),
  brands: (id) => request(`/campaigns/${id}/brands`),
  catalog: (id, params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/campaigns/${id}/catalog${query ? `?${query}` : ''}`)
  },
  campaignSummary: (id) => request(`/campaigns/${id}/summary`),

  // ── soumissions ───────────────────────────────────────────────────────────
  submissions: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/submissions${query ? `?${query}` : ''}`)
  },
  submission: (id) => request(`/submissions/${id}`),
  createSubmission: (body) => request('/submissions', { method: 'POST', body }),
  createMySubmission: (campaignId) =>
    request(`/campaigns/${campaignId}/submission`, { method: 'POST', body: {} }),
  lines: (id) => request(`/submissions/${id}/lines`),
  writeLines: (id, rows, { keepalive } = {}) =>
    request(`/submissions/${id}/lines`, { method: 'PATCH', body: rows, keepalive }),
  submissionSummary: (id) => request(`/submissions/${id}/summary`),
  events: (id) => request(`/submissions/${id}/events`),
  // Lecture seule : la filiale ne choisit pas ses destinataires en copie, seule
  // la relecture Academy affiche la liste. L'écriture (PUT) reste côté serveur.
  cc: (id) => request(`/submissions/${id}/cc`),
  submit: (id, body = {}) => request(`/submissions/${id}/submit`, { method: 'POST', body }),
  validate: (id) => request(`/submissions/${id}/validate`, { method: 'POST', body: {} }),
  reopen: (id, reason) => request(`/submissions/${id}/reopen`, { method: 'POST', body: { reason } }),

  // ── file d'envoi ──────────────────────────────────────────────────────────
  outbound: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return request(`/outbound${query ? `?${query}` : ''}`)
  },
  preview: (id) => request(`/outbound/${id}/preview`),
  approve: (id) => request(`/outbound/${id}/approve`, { method: 'POST', body: {} }),
  reject: (id, reason) => request(`/outbound/${id}/reject`, { method: 'POST', body: { reason } }),
  send: (id) => request(`/outbound/${id}/send`, { method: 'POST', body: {} }),
}
