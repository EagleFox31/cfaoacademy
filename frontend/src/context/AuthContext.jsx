/**
 * Session du portail — authentification RÉELLE (Keycloak OIDC + PKCE).
 *
 * ─── Migration en cours ──────────────────────────────────────────────────────
 * L'identité est démockée ; **les données métier ne le sont pas encore**. Les
 * tableaux de bord lisent toujours `LMS_BY_USER[...]`, indexé par des clés
 * `u1`…`u11`.
 *
 * D'où `demoKey` : elle rattache un compte Keycloak réel à son jeu de données de
 * démonstration. C'est un pont **temporaire**, et il est volontairement visible
 * plutôt que caché — chaque écran démocké retire son usage, et le jour où le
 * dernier tombe, `demoKey` et `mock_profiles.json` disparaissent ensemble.
 *
 * Ce qui est déjà vrai :
 *   - le mot de passe est vérifié par Keycloak, jamais par l'application ;
 *   - le jeton vit en `sessionStorage` et expire ;
 *   - **rôles et périmètre viennent de `GET /me`**, donc de la base `identity` —
 *     plus d'un fichier JSON que le navigateur choisit lui-même.
 *
 * Interdit n° 6 de l'audit Academix (« le rôle lu côté client ») : levé pour
 * l'identité. Les rôles servent encore à l'affichage, mais toute décision d'accès
 * est prise par l'API via Cerbos.
 *
 * ─── Silent Refresh ──────────────────────────────────────────────────────────
 * Le JWT vit 15 minutes. Le renouvellement transparent est géré par `auth.js`
 * (timer proactif + mutex). Ce contexte écoute les événements
 * `cfao:session_refreshed` et `cfao:session_expired` pour mettre à jour l'état
 * React sans scintillement ni rechargement de page.
 */
import { createContext, useCallback, useEffect, useRef, useState } from 'react'

import profiles from '../data/mock_profiles.json'
import { api } from '../lib/api'
import {
  clearLocalSession,
  login as oidcLogin,
  loginWithCredentials,
  logout as oidcLogout,
  onSessionExpired,
  onSessionRefreshed,
  readSession,
  scheduleSilentRefresh,
} from '../lib/auth'

export const AuthContext = createContext(null)

/**
 * Compte Keycloak → jeu de données de démonstration.
 *
 * Table de transition, appelée à disparaître. Un compte absent d'ici se connecte
 * normalement : il n'aura simplement pas de données mockées, ce qui est le
 * comportement souhaité une fois les écrans démockés.
 */
const DEMO_KEY_BY_USERNAME = {
  'kouame.assi': 'u1',
  'brahim.tahir': 'u2',
  'seydou.diallo': 'u3',
  'fatou.mbaye': 'u4',
  'aminata.kone': 'u5',
  'admin.groupe': 'u6',
  'tech.lead': 'u7',
  'moa.pilotage': 'u8',
  'loic.traore': 'u9',
  'jacques.robin': 'u10',
  'andre.yogba': 'u11',
}

function demoProfileFor(username) {
  const key = DEMO_KEY_BY_USERNAME[username]
  return key ? profiles.find((p) => p.id === key) ?? null : null
}

/**
 * Construit l'utilisateur du portail à partir des trois sources, par ordre
 * décroissant d'autorité :
 *   1. `/me` — rôles et périmètre résolus en base (fait foi) ;
 *   2. les claims du jeton — état civil, repli si `/me` est injoignable ;
 *   3. le profil de démonstration — uniquement ce qu'aucun backend ne sert
 *      encore (identifiants MEDACAP, niveaux de certification, libellés démo).
 */
function buildUser(session, me) {
  const claims = session.claims ?? {}
  const username = claims.preferred_username ?? ''
  const demo = demoProfileFor(username)

  return {
    // ── ce qui n'est plus mocké ──────────────────────────────────────────
    sub: claims.sub,
    username,
    email: claims.email ?? demo?.email ?? '',
    firstName: claims.given_name ?? demo?.firstName ?? '',
    lastName: claims.family_name ?? demo?.lastName ?? '',
    roles: me?.roles ?? claims.realm_access?.roles ?? [],
    scopeNodes: me?.scopeNodes ?? (claims.scopeNode ? [claims.scopeNode] : []),
    departments: me?.departments ?? claims.departments ?? [],
    brands: me?.brands ?? claims.brands ?? [],
    orgPath: claims.orgPath ?? demo?.orgPath ?? '',
    // « identity » = résolu en base, « token » = compte pas encore migré.
    scopeSource: me?.source ?? 'token',

    // ── pont temporaire vers les données de démonstration ────────────────
    demoKey: demo?.id ?? null,
    ...(demo
      ? {
          orgLabel: demo.orgLabel,
          pays: demo.pays,
          filiale: demo.filiale,
          avatarSkin: demo.avatarSkin,
          demoLabel: demo.demoLabel,
          persona: demo.persona,
          public: demo.public,
          certLevels: demo.certLevels,
          instructorBrands: demo.instructorBrands,
          kiNetworkId: demo.kiNetworkId,
          kiSubsidiary: demo.kiSubsidiary,
          // MEDACAP reste interrogé depuis le navigateur : ces identifiants
          // n'ont pas leur place dans un jeton (cf. backend-architecture.md,
          // cas 6 — un connecteur serveur est prévu).
          medacapUserId: demo.medacapUserId,
          medacapEmail: demo.medacapEmail,
          medacapUsername: demo.medacapUsername,
          kiScopeMedacapUserId: demo.kiScopeMedacapUserId,
          kiScopeMedacapEmail: demo.kiScopeMedacapEmail,
        }
      : {}),
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readSession())
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState(() => (readSession() ? 'loading' : 'anonymous'))

  // Ref pour stocker le dernier objet `me` résolu, afin de reconstruire le user
  // lors d'un Silent Refresh sans rappeler /me (le profil ne change pas en 15 min).
  const lastMeRef = useRef(null)

  const resolve = useCallback(async (current) => {
    if (!current) {
      setUser(null)
      setStatus('anonymous')
      return
    }
    try {
      const me = await api.me()
      lastMeRef.current = me
      setUser(buildUser(current, me))
      setStatus('ready')
    } catch (error) {
      if (error?.status === 401) {
        // Jeton refusé : `api` a déjà déclenché la reconnexion.
        clearLocalSession()
        setUser(null)
        setStatus('anonymous')
        return
      }
      // API injoignable : on reste connecté avec les claims du jeton plutôt que
      // d'éjecter quelqu'un dont la session est valide. `scopeSource` vaudra
      // « token », et l'interface peut le signaler.
      setUser(buildUser(current, null))
      setStatus('degraded')
    }
  }, [])

  // ── Résolution initiale ──────────────────────────────────────────────
  useEffect(() => {
    resolve(session)
  }, [session, resolve])

  // ── Silent Refresh : planification initiale + écoute des événements ──
  useEffect(() => {
    // Planifier le premier Silent Refresh au montage si une session existe
    const currentSession = readSession()
    if (currentSession) {
      scheduleSilentRefresh(currentSession)
    }

    // Écouter les renouvellements transparents de session
    const unsubRefreshed = onSessionRefreshed((freshSession) => {
      // Mettre à jour l'état React avec la session rafraîchie sans recharger
      // le profil /me (il ne change pas entre deux refresh de 15 min).
      setSession(freshSession)
      if (freshSession && lastMeRef.current) {
        setUser(buildUser(freshSession, lastMeRef.current))
      }
    })

    // Écouter les expirations de session (refresh échoué)
    const unsubExpired = onSessionExpired(() => {
      clearLocalSession()
      setUser(null)
      setStatus('anonymous')
    })

    return () => {
      unsubRefreshed()
      unsubExpired()
    }
  }, [])

  function login() {
    oidcLogin()
  }

  const loginWithPassword = useCallback(async (username, password) => {
    const newSession = await loginWithCredentials(username, password)
    setSession(newSession)
    await resolve(newSession)
    return newSession
  }, [resolve])

  function logout() {
    setUser(null)
    setStatus('anonymous')
    oidcLogout()
  }

  return (
    <AuthContext.Provider
      value={{ user, session, status, login, loginWithPassword, logout, adoptSession: setSession, profiles }}
    >
      {children}
    </AuthContext.Provider>
  )
}
