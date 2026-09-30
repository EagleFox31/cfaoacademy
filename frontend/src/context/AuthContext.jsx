import { createContext, useEffect, useState } from 'react'
import profiles from '../data/mock_profiles.json'

export const AuthContext = createContext(null)

// Le profil connecte, pour les modules qui le lisent hors de React
// (`brouillonsCompteRendu`). Un compte vient de la session du serveur ;
// un profil de demonstration, de la liste de la page de connexion.
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser)
  // Le temps de demander au serveur si une session est ouverte : sans
  // cette attente, le portail renverrait un formateur connecte vers la
  // page de connexion.
  const [verification, setVerification] = useState(true)

  useEffect(() => {
    let actif = true
    appeler(SESSION)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(profil => {
        if (!actif) return
        if (profil) {
          retenir(profil)
          setUser(profil)
        }
        setVerification(false)
      })
    return () => { actif = false }
  }, [])

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
    retenir(profil)
    setUser(profil)
    return null
  }

  /** Profil de demonstration : ferme d'abord une session de compte. */
  function login(userId) {
    const profile = resolveProfile(userId)
    if (!profile) return
    if (user?.compte) appeler('/cr-donnees/deconnexion', { method: 'POST' }).catch(() => {})
    retenir(profile)
    setUser(profile)
  }

  function logout() {
    if (user?.compte) appeler('/cr-donnees/deconnexion', { method: 'POST' }).catch(() => {})
    retenir(null)
    setUser(null)
  }

  if (verification) return null

  return (
    <AuthContext.Provider value={{ user, login, connexion, logout, profiles }}>
      {children}
    </AuthContext.Provider>
  )
}
