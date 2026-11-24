import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { OIDC_ACTIF } from '../lib/auth.js'

/**
 * Lecture d'une ressource d'administration.
 * Retour : { data, status } avec status ∈ 'loading' | 'ready' | 'forbidden'
 * | 'offline' (pas de connexion centrale, mode local) | 'error'.
 * Rien n'est inventé : en cas d'échec, `data` reste null.
 */
export default function useAdminResource(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, status: OIDC_ACTIF ? 'loading' : 'offline' })

  useEffect(() => {
    if (!OIDC_ACTIF) return undefined
    let cancelled = false
    setState({ data: null, status: 'loading' })
    fetcher()
      .then(data => { if (!cancelled) setState({ data, status: 'ready' }) })
      .catch(e => {
        if (cancelled) return
        const status = e instanceof ApiError && e.status === 403 ? 'forbidden' : 'error'
        setState({ data: null, status })
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

/** Curseur de la page suivante d'une réponse paginée DRF (URL complète ou null). */
export function nextCursor(next) {
  if (!next) return null
  try {
    return new URL(next, 'http://x').searchParams.get('cursor')
  } catch {
    return null
  }
}

/** Tous les comptes visibles, page par page (plafond de sécurité : 40 pages). */
export function fetchAllUsers(list = api.users, maxPages = 40) {
  return fetchAllPages(list, maxPages)
}

/** Toutes les pages d'une liste paginée par curseur. Une réponse non paginée (tableau) passe telle quelle. */
export async function fetchAllPages(list, maxPages = 40) {
  const out = []
  let cursor = null
  for (let i = 0; i < maxPages; i += 1) {
    const page = await list(cursor)
    if (Array.isArray(page)) return page
    out.push(...(page?.results ?? []))
    cursor = nextCursor(page?.next)
    if (!cursor) break
  }
  return out
}
