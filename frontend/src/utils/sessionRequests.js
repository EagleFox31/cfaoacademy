/**
 * Souhaits d'inscription : le technicien manifeste son intérêt pour une session
 * auprès de son Chef d'équipe. Persistance locale (localStorage) + événement
 * `cfao:session-request-change` pour la réactivité inter-composants.
 */

const STORAGE_KEY = 'cfao_session_interest_requests'
const EVENT = 'cfao:session-request-change'

export function sessionRequestKey(session) {
  return `${session?.code ?? session?.id ?? ''}|${session?.date ?? ''}`
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* quota / mode privé : on ignore */
  }
}

export function isSessionRequested(userId, key) {
  if (!userId || !key) return false
  return Boolean(readAll()[userId]?.[key])
}

/** Bascule le souhait. Retourne le nouvel état (true = souhait transmis). */
export function toggleSessionRequest(userId, key, metadata = {}) {
  if (!userId || !key) return false
  const all = readAll()
  const forUser = { ...(all[userId] ?? {}) }
  const wasRequested = Boolean(forUser[key])

  if (wasRequested) {
    delete forUser[key]
  } else {
    forUser[key] = { requestedAt: new Date().toISOString(), ...metadata }
  }
  all[userId] = forUser
  writeAll(all)

  window.dispatchEvent(new CustomEvent(EVENT, {
    detail: { userId, key, requested: !wasRequested },
  }))
  return !wasRequested
}

export const SESSION_REQUEST_EVENT = EVENT
