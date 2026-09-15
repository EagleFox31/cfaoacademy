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
const baseIssuer = import.meta.env.VITE_OIDC_ISSUER || ''
const ISSUER = baseIssuer ? baseIssuer.replace('localhost', window.location.hostname) : ''
const CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID || 'needs-web'
const REDIRECT_URI = `${window.location.origin}/callback`

const VERIFIER_KEY = 'needs.pkce.verifier'
const STATE_KEY = 'needs.pkce.state'
const TOKEN_KEY = 'needs.token'
/** Chemin à rouvrir après reconnexion (ex. fiche marque ouverte quand le jeton a expiré). */
const RETURN_KEY = 'needs.auth.return'

let reauthInFlight = false

function sha256Pure(str) {
  function rotr(n, x) { return (x >>> n) | (x << (32 - n)) }
  function ch(x, y, z) { return (x & y) ^ (~x & z) }
  function maj(x, y, z) { return (x & y) ^ (x & z) ^ (y & z) }
  function sigma0(x) { return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x) }
  function sigma1(x) { return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x) }
  function gamma0(x) { return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3) }
  function gamma1(x) { return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10) }

  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]

  let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]

  const utf8 = unescape(encodeURIComponent(str))
  const l = utf8.length
  const words = []
  for (let i = 0; i < l; i++) {
    words[i >>> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8)
  }
  words[l >>> 2] |= 0x80 << (24 - (l % 4) * 8)
  const totalWords = (((l + 8) >>> 6) + 1) * 16
  while (words.length < totalWords) words.push(0)
  words[totalWords - 1] = (l * 8) & 0xffffffff
  words[totalWords - 2] = Math.floor((l * 8) / 0x100000000)

  const W = new Array(64)
  for (let i = 0; i < totalWords; i += 16) {
    for (let t = 0; t < 16; t++) W[t] = words[i + t]
    for (let t = 16; t < 64; t++) {
      W[t] = (gamma1(W[t - 2]) + W[t - 7] + gamma0(W[t - 15]) + W[t - 16]) | 0
    }

    let [a, b, c, d, e, f, g, h] = H
    for (let t = 0; t < 64; t++) {
      const T1 = (h + sigma1(e) + ch(e, f, g) + K[t] + W[t]) | 0
      const T2 = (sigma0(a) + maj(a, b, c)) | 0
      h = g; g = f; f = e; e = (d + T1) | 0
      d = c; c = b; b = a; a = (T1 + T2) | 0
    }
    H[0] = (H[0] + a) | 0
    H[1] = (H[1] + b) | 0
    H[2] = (H[2] + c) | 0
    H[3] = (H[3] + d) | 0
    H[4] = (H[4] + e) | 0
    H[5] = (H[5] + f) | 0
    H[6] = (H[6] + g) | 0
    H[7] = (H[7] + h) | 0
  }

  const out = new Uint8Array(32)
  for (let i = 0; i < 8; i++) {
    out[i * 4] = (H[i] >>> 24) & 0xff
    out[i * 4 + 1] = (H[i] >>> 16) & 0xff
    out[i * 4 + 2] = (H[i] >>> 8) & 0xff
    out[i * 4 + 3] = H[i] & 0xff
  }
  return out
}

function randomString(bytes = 32) {
  const buffer = new Uint8Array(bytes)
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(buffer)
  } else {
    for (let i = 0; i < bytes; i++) buffer[i] = Math.floor(Math.random() * 256)
  }
  return base64url(buffer)
}

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function challengeFrom(verifier) {
  if (typeof window !== 'undefined' && window.crypto?.subtle?.digest) {
    try {
      const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
      return base64url(digest)
    } catch {
      // Fallback
    }
  }
  return base64url(sha256Pure(verifier))
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
      // Conservé pour `id_token_hint` : sans lui, Keycloak ne sait pas quelle
      // session fermer et intercale un écran « êtes-vous sûr ? ».
      idToken: payload.id_token ?? null,
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

export function clearLocalSession() {
  sessionStorage.removeItem(TOKEN_KEY)
}

/**
 * Session invalide / expirée (HTTP 401) : ce n'est pas une erreur métier.
 * On efface le jeton local et on renvoie vers Keycloak — sans banner « erreur ».
 * Un seul redirect même si plusieurs appels API échouent en parallèle.
 */
export function reauthenticate(returnTo) {
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

function readRawSession() {
  try {
    return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null')
  } catch {
    return null
  }
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

// Doit rester aligne sur le role derive `academy_reviewer`
// (cerbos/policies/derived_roles/needs_review.yaml). Un role autorise cote
// serveur mais absent d'ici se connecte sans voir les ecrans de relecture.
const REVIEW_ROLES = ['center_assistant', 'training_coordinator', 'center_director', 'superadmin']

/** L'appartenance à l'équipe Academy — pour la NAVIGATION seulement. */
export function isReviewer(session) {
  return rolesOf(session).some((role) => REVIEW_ROLES.includes(role))
}
