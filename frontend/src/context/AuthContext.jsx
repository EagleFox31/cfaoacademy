import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import profiles from '../data/mock_profiles.json'
import { api } from '../lib/api'
import {
  OIDC_ACTIF,
  clearLocalSession,
  login as oidcLogin,
  logout as oidcLogout,
  onSessionExpired,
  onSessionRefreshed,
  readSession,
  scheduleSilentRefresh,
} from '../lib/auth'

export const AuthContext = createContext(null)

// Le profil connecte est retenu dans le sessionStorage du portail, pour les
// modules du portail qui le lisent hors de React. Le module des comptes rendus
// est une application a part (autre origine, donc autre sessionStorage, meme
// si la cle porte le meme nom) : il tient sa propre session. Un compte vient de la session du serveur ; un profil de
// demonstration, de la liste de la page de connexion.
//
// Keycloak s'ajoute a ce modele sans le remplacer : il n'est actif que si
// `VITE_OIDC_ISSUER` est definie (voir `lib/auth.js`). Le compte Keycloak est
// alors un compte comme un autre (`user.compte`), ses roles et son perimetre
// viennent de `GET /me`.
const CLE = 'cfao_mock_user'
const SESSION = '/cr-donnees/session'

function resolveProfile(userId) {
  return profiles.find(p => p.id === userId) ?? null
}

function retenir(profil) {
  try {
    if (profil) sessionStorage.setItem(CLE, JSON.stringify(profil))
    else sessionStorage.removeItem(CLE)
  } catch { /* stockage indisponible : la session du serveur suffit */ }
}

/** Profil de demonstration de cet onglet ; un compte se verifie aupres du serveur. */
function loadStoredUser() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CLE) || 'null')
    if (!parsed || parsed.compte) return null
    return resolveProfile(parsed.id)
  } catch {
    return null
  }
}

async function appeler(chemin, options = {}) {
  const controle = new AbortController()
  const minuterie = setTimeout(() => controle.abort(), 5000)
  try {
    return await fetch(chemin, { credentials: 'same-origin', signal: controle.signal, ...options })
  } finally {
    clearTimeout(minuterie)
  }
}

function sessionServeur() {
  return appeler(SESSION)
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
}

// ── Compte Keycloak ────────────────────────────────────────────────────────

function normaliser(texte) {
  return String(texte || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Compte Keycloak → jeu de donnees de demonstration.
 *
 * Table de transition : les tableaux de bord lisent encore `LMS_BY_USER[...]`.
 * Un compte absent d'ici se connecte normalement, sans donnees de demonstration.
 */
const DEMO_KEY_BY_USERNAME = {
  'brahim.tahir': 'u2',
  'seydou.diallo': 'u3',
  'fatou.mbaye': 'u4',
  'aminata.kone': 'u5',
  'admin.groupe': 'u6',
  'tech.lead': 'u7',
  'moa.pilotage': 'u8',
  'loic.traore': 'u9',
  'ma31im': 'u9',
  'marc.aurele': 'u9',
  'marc.aurele@cfao.com': 'u9',
  'marc aurele': 'u9',
  'marc-aurele': 'u9',
  'imoma batassi': 'u9',
  '31558': 'u9',
  'jacques.robin': 'u10',
  'andre.yogba': 'u11',
  'venance.tonga': 'u12',
  'venance.tonga@cfao.com': 'u12',
  've72to': 'u12',
  'venance tonga': 'u12',
  'u-manager-demo': 'u12',
}

export function demoProfileFor(username) {
  if (!username) return null
  const brut = String(username).trim()
  const minuscule = brut.toLowerCase()
  const norme = normaliser(brut)

  const cle = DEMO_KEY_BY_USERNAME[minuscule] || DEMO_KEY_BY_USERNAME[norme]
  if (cle) return resolveProfile(cle)

  return profiles.find(p =>
    p.id.toLowerCase() === minuscule ||
    p.medacapUsername?.toLowerCase() === minuscule ||
    p.email?.toLowerCase() === minuscule ||
    (p.medacapUserId && p.medacapUserId === brut) ||
    normaliser(`${p.firstName} ${p.lastName}`) === norme ||
    normaliser(`${p.lastName} ${p.firstName}`) === norme
  ) ?? null
}

/**
 * Utilisateur du portail pour un compte Keycloak, par ordre d'autorite :
 * `/me` (roles et perimetre en base), puis les claims du jeton, puis le profil
 * de demonstration pour ce qu'aucun backend ne sert encore. Les roles ne servent
 * qu'a l'affichage : l'API decide des acces via Cerbos.
 */
export function buildUser(session, me) {
  const claims = session.claims ?? {}
  const username = claims.preferred_username ?? ''
  const demo = demoProfileFor(username) ?? demoProfileFor(claims.email)

  const roles = me?.roles?.length ? me.roles
    : demo?.roles?.length ? demo.roles
      : claims.realm_access?.roles ?? []

  return {
    ...(demo ?? {}),
    id: demo?.id ?? claims.sub,
    demoKey: demo?.id ?? null,
    compte: username || claims.sub,
    oidc: true,
    sub: claims.sub,
    username,
    email: claims.email ?? demo?.email ?? '',
    firstName: demo?.firstName ?? claims.given_name ?? '',
    lastName: demo?.lastName ?? claims.family_name ?? '',
    roles,
    scopeNodes: me?.scopeNodes ?? (claims.scopeNode ? [claims.scopeNode] : []),
    departments: me?.departments ?? demo?.departments ?? claims.departments ?? [],
    brands: me?.brands ?? demo?.brands ?? claims.brands ?? [],
    orgPath: claims.orgPath ?? demo?.orgPath ?? '',
    // « identity » = resolu en base, « token » = /me injoignable.
    scopeSource: me?.source ?? 'token',
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser)
  // 'degraded' : compte Keycloak dont `/me` est injoignable, affiche d'apres le jeton.
  const [degrade, setDegrade] = useState(false)
  // Le temps de demander au serveur si une session est ouverte : sans
  // cette attente, le portail renverrait un formateur connecte vers la
  // page de connexion.
  const [verification, setVerification] = useState(true)
  const dernierMe = useRef(null)

  /** Profil d'une session Keycloak, ou null si l'API refuse le jeton. */
  const profilKeycloak = useCallback(async (session) => {
    let me = null
    try {
      me = await api.me()
    } catch (erreur) {
      if (erreur?.status === 401) {
        clearLocalSession()
        return null
      }
    }
    dernierMe.current = me
    setDegrade(!me)
    return buildUser(session, me)
  }, [])

  useEffect(() => {
    let actif = true
    const jeton = OIDC_ACTIF ? readSession() : null
    if (jeton) scheduleSilentRefresh(jeton)
    ;(jeton ? profilKeycloak(jeton) : sessionServeur()).then(profil => {
      if (!actif) return
      if (profil) {
        retenir(profil)
        setUser(profil)
      }
      setVerification(false)
    })
    return () => { actif = false }
  }, [profilKeycloak])

  useEffect(() => {
    if (!OIDC_ACTIF) return undefined
    const finRafraichi = onSessionRefreshed(session => {
      if (!session) return
      setUser(courant => (courant?.oidc ? buildUser(session, dernierMe.current) : courant))
    })
    const finExpire = onSessionExpired(() => {
      setUser(courant => {
        if (!courant?.oidc) return courant
        retenir(null)
        return null
      })
    })
    return () => { finRafraichi(); finExpire() }
  }, [])

  /** Retour de Keycloak (`/callback`) : resout le profil avant de quitter la page. */
  const adoptSession = useCallback(async (session) => {
    const profil = session ? await profilKeycloak(session) : null
    retenir(profil)
    setUser(profil)
    return profil
  }, [profilKeycloak])

  /** Connexion par le formulaire : renvoie null, ou le motif du refus. */
  async function connexion(identifiant, motDePasse, seSouvenir) {
    let r
    try {
      r = await appeler('/cr-donnees/connexion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiant: identifiant.trim(), motDePasse, seSouvenir }),
      })
    } catch {
      return 'NETWORK'
    }
    if (r.status === 401) return 'INVALID_CREDENTIALS'
    if (!r.ok) return 'GENERIC'
    const profil = await r.json()
    if (user?.oidc) clearLocalSession()
    retenir(profil)
    setUser(profil)
    return null
  }

  /** Connexion d'entreprise : redirige vers Keycloak (sans effet s'il est inactif). */
  function connexionSso() {
    if (OIDC_ACTIF) oidcLogin()
  }

  /** Profil de demonstration : ferme d'abord une session de compte. */
  function login(userId) {
    const profile = resolveProfile(userId)
    if (!profile) return
    if (user?.oidc) clearLocalSession()
    else if (user?.compte) appeler('/cr-donnees/deconnexion', { method: 'POST' }).catch(() => {})
    retenir(profile)
    setUser(profile)
  }

  function logout() {
    retenir(null)
    setUser(null)
    if (user?.oidc) {
      oidcLogout()
      return
    }
    if (user?.compte) appeler('/cr-donnees/deconnexion', { method: 'POST' }).catch(() => {})
  }

  if (verification) return null

  const status = !user ? 'anonymous' : user.oidc && degrade ? 'degraded' : 'ready'

  return (
    <AuthContext.Provider
      value={{ user, status, login, connexion, connexionSso, oidc: OIDC_ACTIF, adoptSession, logout, profiles }}
    >
      {children}
    </AuthContext.Provider>
  )
}
