/**
 * Authentification OIDC — Authorization Code + PKCE, client public.
 *
 * Aucun secret dans le navigateur, par construction : PKCE remplace le secret
 * client. Le jeton reste en mémoire et en `sessionStorage` (pas `localStorage`) —
 * il disparaît à la fermeture de l'onglet.
 *
 * **Le rôle porté par le jeton ne sert qu'à l'affichage.** Toute décision d'accès
 * est prise par l'API, qui interroge Cerbos. Academix restaurait l'utilisateur —
 * rôle compris — depuis `localStorage` sans revalidation (interdit n° 6).
 */
const ISSUER = import.meta.env.VITE_OIDC_ISSUER || ''
const CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID || 'needs-web'
const REDIRECT_URI = `${window.location.origin}/callback`

const VERIFIER_KEY = 'needs.pkce.verifier'
const STATE_KEY = 'needs.pkce.state'
const TOKEN_KEY = 'needs.token'

function randomString(bytes = 32) {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return base64url(buffer)
}

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function challengeFrom(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(digest)
}

export async function login() {
  const verifier = randomString()
  const state = randomString(16)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    state,
    code_challenge: await challengeFrom(verifier),
    code_challenge_method: 'S256',
  })
  window.location.assign(`${ISSUER}/protocol/openid-connect/auth?${params}`)
}

export async function handleCallback() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expected = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)

  if (!code || !state || state !== expected || !verifier) {
    throw new Error('callback_invalid')
  }
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)

  const response = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: verifier,
    }),
  })
  if (!response.ok) throw new Error('token_exchange_failed')

  const payload = await response.json()
  sessionStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({
      accessToken: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 900) * 1000,
      refreshToken: payload.refresh_token ?? null,
    }),
  )
  return readSession()
}

export function readSession() {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session.accessToken || session.expiresAt < Date.now()) return null
    return { ...session, claims: decodeClaims(session.accessToken) }
  } catch {
    return null
  }
}

export function logout() {
  sessionStorage.removeItem(TOKEN_KEY)
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    post_logout_redirect_uri: window.location.origin,
  })
  window.location.assign(`${ISSUER}/protocol/openid-connect/logout?${params}`)
}

/**
 * Lecture NON VÉRIFIÉE des claims — affichage uniquement (nom, rôles pour la
 * navigation). La signature est vérifiée côté API, jamais ici : un navigateur ne
 * peut pas s'auto-autoriser.
 */
function decodeClaims(token) {
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decodeURIComponent(escape(json)))
  } catch {
    return {}
  }
}

export function rolesOf(session) {
  return session?.claims?.realm_access?.roles ?? []
}

const REVIEW_ROLES = ['center_assistant', 'center_director', 'superadmin']

/** L'appartenance à l'équipe Academy — pour la NAVIGATION seulement. */
export function isReviewer(session) {
  return rolesOf(session).some((role) => REVIEW_ROLES.includes(role))
}
