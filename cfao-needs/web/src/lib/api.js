/** Client API — un seul point d'accès, un seul traitement d'erreur. */
import { readSession } from './auth'

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

async function request(path, { method = 'GET', body, headers, raw } = {}) {
  const session = readSession()
  const init = {
    method,
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
  lines: (id) => request(`/submissions/${id}/lines`),
  writeLines: (id, rows) => request(`/submissions/${id}/lines`, { method: 'PATCH', body: rows }),
  submissionSummary: (id) => request(`/submissions/${id}/summary`),
  events: (id) => request(`/submissions/${id}/events`),
  cc: (id) => request(`/submissions/${id}/cc`),
  setCc: (id, rows) => request(`/submissions/${id}/cc`, { method: 'PUT', body: rows }),
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
