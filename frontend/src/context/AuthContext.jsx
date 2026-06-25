import { createContext, useEffect, useState } from 'react'
import profiles from '../data/mock_profiles.json'

export const AuthContext = createContext(null)

function resolveProfile(userId) {
  return profiles.find(p => p.id === userId) ?? null
}

/** Session démo : toujours la version à jour de mock_profiles.json. */
function loadStoredUser() {
  try {
    const saved = sessionStorage.getItem('cfao_mock_user')
    if (!saved) return null
    const parsed = JSON.parse(saved)
    const fresh = resolveProfile(parsed?.id)
    if (fresh) {
      sessionStorage.setItem('cfao_mock_user', JSON.stringify(fresh))
      return fresh
    }
    return parsed
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser)

  // Après HMR ou mise à jour mock_profiles : resynchroniser la session.
  useEffect(() => {
    setUser(prev => {
      if (!prev?.id) return prev
      const fresh = resolveProfile(prev.id)
      if (!fresh) return prev
      sessionStorage.setItem('cfao_mock_user', JSON.stringify(fresh))
      return fresh
    })
  }, [])

  function login(userId) {
    const profile = resolveProfile(userId)
    if (!profile) return
    sessionStorage.setItem('cfao_mock_user', JSON.stringify(profile))
    setUser(profile)
  }

  function logout() {
    sessionStorage.removeItem('cfao_mock_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, profiles }}>
      {children}
    </AuthContext.Provider>
  )
}
