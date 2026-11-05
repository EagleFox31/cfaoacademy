import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import useAuth from '../hooks/useAuth'
import useLocale from '../hooks/useLocale'
import { getPrimaryRole } from '../data/index.js'

export default function PortalDemoBar() {
  // Uniquement visible en environnement de développement local (masqué en production)
  if (!import.meta.env.DEV) return null

  const { user, logout, status } = useAuth()
  const { t } = useLocale('portal')
  const navigate = useNavigate()
  const [minimized, setMinimized] = useState(false)

  // Un compte personnel ne passe pas d'un profil a l'autre.
  if (!user || user.compte) return null

  const nom = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username
  const primaryRole = getPrimaryRole(user.roles)
  const roleLabel = t[`role_${primaryRole}`] || primaryRole

  if (minimized) {
    return (
      <aside className="portal-demo-bar portal-demo-bar--minimized" aria-label="Bandeau démo développeur réduit">
        <button
          type="button"
          className="portal-demo-bar-restore-btn"
          onClick={() => setMinimized(false)}
          title="Agrandir la barre de session dev"
        >
          <span className="portal-demo-bar-badge portal-demo-bar-badge--tag">DEV</span>
          <span className="portal-demo-bar-min-name">{nom}</span>
          <span className="portal-demo-bar-expand-icon" aria-hidden="true">▲</span>
        </button>
      </aside>
    )
  }

  return (
    <aside className="portal-demo-bar" aria-label="Bandeau de session développeur">
      <div className="portal-demo-bar-left">
        <span className="portal-demo-bar-badge portal-demo-bar-badge--tag">DEV</span>

        <span className="portal-demo-bar-identity">
          <strong className="portal-demo-bar-name">{nom}</strong>
          {roleLabel && (
            <span className="portal-demo-bar-role-chip">{roleLabel}</span>
          )}
        </span>

        {status === 'degraded' && (
          <span className="portal-demo-bar-badge portal-demo-bar-badge--warning" title="GET /me injoignable (mode local)">
            Hors ligne
          </span>
        )}

        {user.scopeSource === 'token' && (
          <span className="portal-demo-bar-badge portal-demo-bar-badge--info" title="Compte absent de la base identity : périmètre lu depuis le jeton">
            Jeton brut
          </span>
        )}
      </div>

      <div className="portal-demo-bar-actions">
        <button
          type="button"
          className="portal-demo-bar-btn portal-demo-bar-btn--secondary"
          onClick={logout}
          title="Se déconnecter de Keycloak pour changer de compte"
        >
          Changer de compte
        </button>

        <button
          type="button"
          className="portal-demo-bar-btn portal-demo-bar-btn--accent"
          onClick={() => navigate('/portail/ki-gemini')}
          title="Accéder à la maquette démonstrateur"
        >
          ✨ Démo KI-Gemini
        </button>

        <button
          type="button"
          className="portal-demo-bar-close-btn"
          onClick={() => setMinimized(true)}
          title="Réduire ce bandeau"
          aria-label="Réduire"
        >
          —
        </button>
      </div>
    </aside>
  )
}

