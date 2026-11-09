/**
 * Authentification OIDC du portail — Authorization Code + PKCE, client public.
 *
 * Porté depuis `cfao-needs/web/src/lib/auth.js`, où ce flux tourne déjà contre
 * Keycloak. Même patron, mêmes garanties — seules les clés de stockage et le
 * client changent (`cfao-spa`, realm `cfao`).
 *
 * Aucun secret dans le navigateur, par construction : PKCE remplace le secret
 * client. Le jeton reste en mémoire et en `sessionStorage` (pas `localStorage`) —
 * il disparaît à la fermeture de l'onglet.
 *
 * **Le rôle porté par le jeton ne sert qu'à l'affichage.** Toute décision d'accès
 * est prise par l'API, qui interroge Cerbos. Academix restaurait l'utilisateur —
 * rôle compris — depuis `localStorage` sans revalidation (interdit n° 6).
 *
 * ── Silent Refresh ──────────────────────────────────────────────────────────────
 * Le JWT vit 15 minutes. La continuité de navigation (formations longues, tableaux
 * de bord ouverts) est assurée par un rafraîchissement transparent tant que la
 * session SSO Keycloak est active. Le timer se déclenche 60 secondes avant
 * l'échéance ; un mutex garantit une seule requête réseau même si plusieurs
 * composants ou appels API réclament un rafraîchissement simultanément.
 */
/**
 * Keycloak n'est actif que si `VITE_OIDC_ISSUER` est définie. Sans elle, le
 * portail garde son modèle : profils de démonstration et comptes formateurs
 * servis par `/cr-donnees`. Aucun appel ne part alors vers Keycloak.
 */
export const OIDC_ACTIF = Boolean((import.meta.env.VITE_OIDC_ISSUER || '').trim())

/**
 * Portail servi derrière cfao-edge : Keycloak est sur la même origine, sous
 * /auth/. La connexion passe alors uniquement par la page Keycloak (pas de
 * modale du portail, ni comptes CR, ni « se souvenir de moi »).
 */
export function connexionKeycloakSeule() {
  if (!OIDC_ACTIF || typeof window === 'undefined') return false
  return resolveIssuer().startsWith(`${window.location.origin}/auth/`)
}

function resolveIssuer() {
  const envIssuer = (import.meta.env.VITE_OIDC_ISSUER || '').trim()
  if (!envIssuer) return ''
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return envIssuer
      .replace('//localhost:', `//${window.location.hostname}:`)
      .replace('//127.0.0.1:', `//${window.location.hostname}:`)
  }
  return envIssuer
}

const ISSUER = resolveIssuer()
const CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID || 'cfao-spa'
const REDIRECT_URI = typeof window !== 'undefined' ? `${window.location.origin}/callback` : 'http://localhost:5173/callback'

const VERIFIER_KEY = 'cfao.pkce.verifier'
const STATE_KEY = 'cfao.pkce.state'
const TOKEN_KEY = 'cfao.token'
/** Chemin à rouvrir après reconnexion (ex. fiche marque ouverte quand le jeton a expiré). */
const RETURN_KEY = 'cfao.auth.return'

/** Marge de sécurité avant expiration (60 secondes). */
const REFRESH_MARGIN_MS = 60_000
/** Marge proactive pour l'intercepteur HTTP (45 secondes). */
const PROACTIVE_MARGIN_MS = 45_000

let reauthInFlight = false

// ── Silent Refresh : état interne ──────────────────────────────────────────────
/** Timer ID du rafraîchissement proactif planifié. */
let refreshTimerId = null
/** Promesse partagée pour le mutex de rafraîchissement (une seule requête en vol). */
let refreshPromise = null

// ── Événement personnalisé pour synchroniser React ─────────────────────────────
const SESSION_REFRESHED_EVENT = 'cfao:session_refreshed'
const SESSION_EXPIRED_EVENT = 'cfao:session_expired'

function emitSessionRefreshed(session) {
  window.dispatchEvent(new CustomEvent(SESSION_REFRESHED_EVENT, { detail: session }))
}

function emitSessionExpired() {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
}

/** S'abonner aux renouvellements de session. Retourne une fonction de désabonnement. */
export function onSessionRefreshed(callback) {
  const handler = (e) => callback(e.detail)
  window.addEventListener(SESSION_REFRESHED_EVENT, handler)
  return () => window.removeEventListener(SESSION_REFRESHED_EVENT, handler)
}

/** S'abonner aux expirations de session. Retourne une fonction de désabonnement. */
export function onSessionExpired(callback) {
  window.addEventListener(SESSION_EXPIRED_EVENT, callback)
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, callback)
}

// ── PKCE helpers ───────────────────────────────────────────────────────────────

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

// ── Session storage helpers (miroir de confort d'onglet, jamais localStorage) ──

function storeSession(payload) {
  const session = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 900) * 1000,
    refreshToken: payload.refresh_token ?? null,
    // Conservé pour `id_token_hint` : sans lui, Keycloak ne sait pas quelle
    // session fermer et intercale un écran « êtes-vous sûr ? ».
    idToken: payload.id_token ?? null,
  }
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(session))
  } catch {
    /* private mode — les tokens restent quand même en mémoire via readSession */
  }
  return session
}

// ── Login flows ────────────────────────────────────────────────────────────────

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

/**
 * Authentification directe par identifiant et mot de passe (Direct Access Grant).
 * Permet au formulaire CFAO natif dans la SPA de s'authentifier directement
 * auprès de Keycloak sans quitter la page ni perdre le visuel de la plateforme.
 */
export async function loginWithCredentials(username, password) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 2500)

  try {
    const response = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: CLIENT_ID,
        username: username.trim(),
        password,
        scope: 'openid profile email cfao-scope',
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const err = new Error(errorData.error_description || errorData.error || 'invalid_credentials')
      err.code = errorData.error
      throw err
    }

    const payload = await response.json()
    storeSession(payload)
    const session = readSession()
    scheduleSilentRefresh(session)
    return session
  } finally {
    clearTimeout(timeoutId)
  }
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
  storeSession(payload)
  const session = readSession()
  scheduleSilentRefresh(session)
  return session
}

// ── Session reading ────────────────────────────────────────────────────────────

export function readSession() {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session.accessToken || session.expiresAt < Date.now()) return null
    const claims = (session.claims && Object.keys(session.claims).length > 0)
      ? session.claims
      : decodeClaims(session.accessToken)
    return { ...session, claims }
  } catch {
    return null
  }
}

/**
 * Vérifie si le token actuel expire dans les prochaines `marginMs` millisecondes.
 * Utilisé par l'intercepteur HTTP pour déclencher un refresh proactif avant la requête.
 */
export function isTokenExpiringSoon(marginMs = PROACTIVE_MARGIN_MS) {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return true
    const session = JSON.parse(raw)
    if (!session.accessToken) return true
    return session.expiresAt - Date.now() < marginMs
  } catch {
    return true
  }
}

/** Lecture brute (interne) sans vérification d'expiration — pour récupérer le refreshToken. */
function readRawSession() {
  try {
    return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null')
  } catch {
    return null
  }
}

export function clearLocalSession() {
  cancelSilentRefresh()
  sessionStorage.removeItem(TOKEN_KEY)
}

// ── Silent Refresh ─────────────────────────────────────────────────────────────
//
// Mécanisme de renouvellement transparent du JWT. Le timer se déclenche
// `REFRESH_MARGIN_MS` avant l'expiration de l'access token. Si la session SSO
// Keycloak est encore active, un nouveau couple (access_token, refresh_token)
// est obtenu de manière invisible pour l'utilisateur.
//
// Le mutex (`refreshPromise`) garantit qu'une seule requête de rafraîchissement
// est en vol à un instant donné, même si plusieurs composants ou appels API
// demandent un rafraîchissement en même temps.

/**
 * Rafraîchit la session courante auprès de Keycloak.
 *
 * Retourne la session rafraîchie, ou `null` si le refresh a échoué (session SSO
 * expirée, révoquée, ou Keycloak injoignable).
 *
 * Le mutex est implémenté par `refreshPromise` : si un rafraîchissement est déjà
 * en vol, tous les appelants attendent la même promesse.
 */
export async function refreshSession() {
  // Mutex : si un refresh est déjà en vol, attendre sa résolution
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = _doRefresh()
  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

async function _doRefresh() {
  const raw = readRawSession()
  if (!raw?.refreshToken) {
    // Pas de refresh token disponible — pas de miracle possible
    emitSessionExpired()
    return null
  }

  try {
    const response = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        refresh_token: raw.refreshToken,
      }),
    })

    if (!response.ok) {
      // Session SSO expirée ou refresh token révoqué
      console.warn('[auth] Silent refresh failed — session SSO expired or revoked.')
      emitSessionExpired()
      return null
    }

    const payload = await response.json()
    storeSession(payload)
    const session = readSession()

    // Replanifier le prochain refresh
    scheduleSilentRefresh(session)
    // Notifier React
    emitSessionRefreshed(session)

    return session
  } catch (err) {
    // Keycloak injoignable (réseau, DNS, maintenance)
    console.warn('[auth] Silent refresh network error:', err.message)
    // On ne signale pas l'expiration immédiatement : la session pourrait encore être
    // utilisable si Keycloak revient. On tente un re-schedule plus agressif.
    _scheduleRetryAfterNetworkError()
    return null
  }
}

/**
 * Planifie le prochain rafraîchissement automatique.
 *
 * Le timer se déclenche `REFRESH_MARGIN_MS` (60 secondes) avant l'expiration
 * du token. Si le token est déjà en zone critique, le refresh est lancé
 * immédiatement.
 */
export function scheduleSilentRefresh(session) {
  cancelSilentRefresh()

  if (!session?.expiresAt) return

  const delay = session.expiresAt - Date.now() - REFRESH_MARGIN_MS
  if (delay <= 0) {
    // Déjà en zone critique — refresh immédiat
    refreshSession()
    return
  }

  refreshTimerId = setTimeout(() => {
    refreshTimerId = null
    refreshSession()
  }, delay)
}

/** Annule le timer de rafraîchissement planifié. */
export function cancelSilentRefresh() {
  if (refreshTimerId !== null) {
    clearTimeout(refreshTimerId)
    refreshTimerId = null
  }
}

/**
 * Si une erreur réseau empêche le refresh, on réessaie dans 30 secondes
 * plutôt que d'abandonner — Keycloak peut revenir.
 */
function _scheduleRetryAfterNetworkError() {
  cancelSilentRefresh()
  refreshTimerId = setTimeout(() => {
    refreshTimerId = null
    refreshSession()
  }, 30_000)
}

// ── Visibility change : refresh au retour d'onglet inactif ─────────────────────

/**
 * Quand l'utilisateur réactive un onglet resté en arrière-plan (changement
 * d'onglet, sortie de veille), vérifier l'état du token et rafraîchir si
 * nécessaire. Cela couvre le cas où le timer a été gelé par le navigateur
 * pendant la mise en veille de l'onglet.
 */
function _handleVisibilityChange() {
  if (document.visibilityState !== 'visible') return

  const session = readSession()
  if (!session) {
    // Session expirée pendant l'inactivité — tenter un refresh
    const raw = readRawSession()
    if (raw?.refreshToken) {
      refreshSession()
    }
    return
  }

  // Session encore valide mais bientôt expirée : rafraîchir proactivement
  if (isTokenExpiringSoon(90_000)) {
    refreshSession()
  }
}

// Enregistrer l'écouteur une seule fois au chargement du module
document.addEventListener('visibilitychange', _handleVisibilityChange)

// ── Reauthenticate (redirect vers Keycloak en dernier recours) ─────────────────

/**
 * Session invalide / expirée (HTTP 401) : ce n'est pas une erreur métier.
 * On efface le jeton local et on renvoie vers Keycloak — sans banner « erreur ».
 * Un seul redirect même si plusieurs appels API échouent en parallèle.
 */
export function reauthenticate(returnTo) {
  if (!OIDC_ACTIF) {
    clearLocalSession()
    return
  }
  if (reauthInFlight) return
  reauthInFlight = true

  const path =
    returnTo ??
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  try {
    if (path && path !== '/' && !path.startsWith('/callback')) {
      sessionStorage.setItem(RETURN_KEY, path)
    }
  } catch {
    /* private mode */
  }

  clearLocalSession()
  login()
}

export function consumeAuthReturnPath() {
  try {
    const path = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    if (path && path.startsWith('/') && !path.startsWith('//')) return path
  } catch {
    /* private mode */
  }
  return '/'
}

// ── Logout OIDC complet ────────────────────────────────────────────────────────

/**
 * Déconnexion directe — pas d'écran d'adieu.
 *
 * `id_token_hint` désigne la session à fermer : Keycloak la ferme et renvoie
 * aussitôt sur la page de connexion. Sans ce paramètre il affiche une page de
 * confirmation, puis échoue si la session n'est plus là — ce qui donne un
 * « la déconnexion a échoué » alors que l'utilisateur a bien été déconnecté.
 *
 * L'URI de retour porte sa barre finale : le client n'autorise que
 * `http://localhost:8080/*`, et l'origine nue tombe hors du motif.
 */
export function logout() {
  const idToken = readRawSession()?.idToken
  clearLocalSession()
  try {
    sessionStorage.removeItem(RETURN_KEY)
  } catch {
    /* private mode */
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    post_logout_redirect_uri: `${window.location.origin}/`,
  })
  if (idToken) params.set('id_token_hint', idToken)

  window.location.assign(`${ISSUER}/protocol/openid-connect/logout?${params}`)
}

// ── Claims & rôles (AFFICHAGE uniquement) ──────────────────────────────────────

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

/** Rôles portés par le jeton — AFFICHAGE et navigation uniquement. */
export function hasRole(session, ...roles) {
  const mine = rolesOf(session)
  return roles.some((role) => mine.includes(role))
}

/**
 * Garantit un token frais avant d'émettre une requête API.
 * Si le token est en zone critique (< 45s), attend la résolution du refresh.
 * Si le token est expiré mais qu'un refresh_token existe, tente le refresh.
 * Retourne la session fraîche ou null.
 */
export async function ensureFreshToken() {
  const session = readSession()
  if (session && !isTokenExpiringSoon()) {
    return session
  }
  // Token expirant ou expiré : tenter un refresh
  const raw = readRawSession()
  if (raw?.refreshToken) {
    return await refreshSession()
  }
  return session // peut être null si expiré sans refresh token
}
