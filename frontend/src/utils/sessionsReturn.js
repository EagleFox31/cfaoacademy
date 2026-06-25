/** Retour accueil (section + sessions) après fermeture d'une fiche. */

import { canonicalTrainingCode } from './trainingCode.js'

export const SESSIONS_RETURN_STORAGE_KEY = 'cfao_sessions_return_v1'

export function appendSessionsReturnParams(params, state) {
  if (!state) return params
  if (state.sectionId) params.set('from', state.sectionId)
  if (state.tab) params.set('st', state.tab)
  if (state.expanded) params.set('se', '1')
  if (state.brand && state.brand !== 'all') params.set('sb', state.brand)
  if (state.scrollY > 0) params.set('sy', String(Math.round(state.scrollY)))
  return params
}

export function parseSessionsReturnParams(searchParams) {
  const tab = searchParams.get('st')
  const brand = searchParams.get('sb')
  return {
    sectionId: searchParams.get('from') || null,
    tab: tab || null,
    expanded: searchParams.get('se') === '1',
    brand: brand || 'all',
    scrollY: Number(searchParams.get('sy')) || 0,
  }
}

export function persistSessionsReturn(state) {
  if (!state?.tab && !state?.sectionId) return
  try {
    sessionStorage.setItem(SESSIONS_RETURN_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota / private mode */
  }
}

export function readSessionsReturnStorage() {
  try {
    const raw = sessionStorage.getItem(SESSIONS_RETURN_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearSessionsReturnStorage() {
  try {
    sessionStorage.removeItem(SESSIONS_RETURN_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function pickReturnState(location) {
  return location?.state?.homeReturn ?? location?.state?.sessionsReturn ?? null
}

/** Fusionne state React Router, query fiche et sessionStorage. */
export function mergeSessionsReturn(location, searchParams) {
  const fromState = pickReturnState(location)
  const fromUrl = searchParams ? parseSessionsReturnParams(searchParams) : null
  const stored = readSessionsReturnStorage()
  const scrollFromNav =
    location?.state?.restoreHomeScroll
    ?? location?.state?.restoreSessionsScroll

  const tab = fromState?.tab ?? fromUrl?.tab ?? stored?.tab ?? null
  const sectionId =
    fromState?.sectionId
    ?? fromUrl?.sectionId
    ?? stored?.sectionId
    ?? (tab ? 'sessions' : null)

  if (!sectionId && !tab) {
    return null
  }

  const brandFromState = fromState?.brand
  const brandFromUrl = fromUrl?.brand !== 'all' ? fromUrl?.brand : null
  const brandFromStore = stored?.brand && stored.brand !== 'all' ? stored.brand : null

  return {
    sectionId,
    tab,
    expanded: Boolean(
      fromState?.expanded ?? fromUrl?.expanded ?? stored?.expanded,
    ),
    brand: brandFromState ?? brandFromUrl ?? brandFromStore ?? 'all',
    scrollY:
      scrollFromNav
      ?? fromState?.scrollY
      ?? fromUrl?.scrollY
      ?? stored?.scrollY
      ?? 0,
  }
}

export function hasSessionsReturn(location, searchParams) {
  return Boolean(mergeSessionsReturn(location, searchParams))
}

/** Destination Link vers la fiche (state + query de secours). */
export function buildFormationFicheTo(session, sessionsReturn) {
  const code = canonicalTrainingCode(session?.code)
  const params = new URLSearchParams()
  if (session?.date) params.set('date', session.date)
  const ctx = sessionsReturn?.tab || sessionsReturn?.sectionId
    ? {
        ...sessionsReturn,
        sectionId: sessionsReturn.sectionId ?? (sessionsReturn.tab ? 'sessions' : null),
      }
    : null
  appendSessionsReturnParams(params, ctx)
  const search = params.toString() ? `?${params.toString()}` : ''

  return {
    pathname: `/formations/fiche/${encodeURIComponent(code)}`,
    search,
    state: ctx ? { homeReturn: ctx, sessionsReturn: ctx.tab ? ctx : undefined } : undefined,
  }
}

/** Lien de fermeture fiche → accueil avec section / sessions restaurées. */
export function sessionsHomeReturnLink(location, searchParams) {
  const merged = mergeSessionsReturn(location, searchParams)
  if (!merged?.sectionId) {
    return { pathname: '/', hash: '', search: '', state: {} }
  }

  const params = new URLSearchParams()
  appendSessionsReturnParams(params, merged)
  const qs = params.toString()

  return {
    pathname: '/',
    hash: `#${merged.sectionId}`,
    search: qs ? `?${qs}` : '',
    state: {
      homeReturn: merged,
      restoreHomeScroll: merged.scrollY,
      sessionsReturn: merged.tab ? merged : undefined,
      restoreSessionsScroll: merged.scrollY,
    },
  }
}

export function scheduleSessionsScroll(restore, { delayNavigate = true } = {}) {
  if (!restore) return () => {}

  const sectionId = restore.sectionId ?? (restore.tab ? 'sessions' : null)

  const applyScroll = () => {
    if (restore.scrollY > 0) {
      window.scrollTo({ top: restore.scrollY, left: 0, behavior: 'auto' })
    } else if (sectionId) {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'auto', block: 'start' })
    }
  }

  const t1 = requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      applyScroll()
      setTimeout(applyScroll, 50)
      setTimeout(applyScroll, 150)
      setTimeout(applyScroll, 350)
      if (delayNavigate) {
        setTimeout(clearSessionsReturnStorage, 400)
      }
    })
  })

  return () => cancelAnimationFrame(t1)
}
