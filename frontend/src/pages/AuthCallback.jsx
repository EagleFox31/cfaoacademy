/**
 * Retour de Keycloak — échange du code d'autorisation contre un jeton.
 *
 * Étape obligatoire du flux Authorization Code + PKCE : sans cette route, le
 * navigateur revient de Keycloak avec un `?code=…` que personne ne consomme, et
 * la connexion n'aboutit jamais.
 *
 * On reprend ensuite le chemin d'où l'on venait : quelqu'un dont la session a
 * expiré en plein travail doit revenir sur son écran, pas sur l'accueil.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import useAuth from '../hooks/useAuth'
import useLocale from '../hooks/useLocale'
import PortalLoader from '../components/PortalLoader'
import { consumeAuthReturnPath, handleCallback } from '../lib/auth'

// Le code d'autorisation ne s'échange qu'une fois : le double montage de
// StrictMode doit reprendre le même échange, pas en relancer un second.
let echangeEnCours = null
let codeEchange = null

function echanger() {
  const code = new URL(window.location.href).searchParams.get('code')
  if (!echangeEnCours || code !== codeEchange) {
    codeEchange = code
    echangeEnCours = handleCallback()
  }
  return echangeEnCours
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const { adoptSession, connexionSso } = useAuth()
  const { t } = useLocale('login')
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    let vivant = true
    echanger()
      .then((session) => adoptSession(session))
      .then(() => {
        if (!vivant) return
        const returnPath = consumeAuthReturnPath()
        const target = (!returnPath || returnPath === '/' || returnPath.startsWith('/callback'))
          ? '/portail'
          : returnPath
        navigate(target, { replace: true })
      })
      .catch((err) => {
        console.error('[AuthCallback] Erreur d’échange de code :', err)
        if (vivant) setErreur(true)
      })
    return () => {
      vivant = false
    }
  }, [navigate, adoptSession])

  if (erreur) {
    return (
      <div className="login-page">
        <div className="login-card-wrap" style={{ margin: 'auto' }}>
          <div className="login-card login-card--glass" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <div className="login-card-brand">
              <img
                src="/assets/logo-cfao-mobility.jpg"
                alt="CFAO Academy"
                className="login-card-logo"
              />
            </div>
            <h1 style={{ fontSize: 20, margin: '16px 0 8px', color: 'var(--navy)' }}>
              {t.authFailed || 'Connexion interrompue'}
            </h1>
            <p style={{ color: 'var(--muted, #6b7280)', marginBottom: 24, lineHeight: 1.5, fontSize: 14 }}>
              Le lien de retour n’était plus valide ou la session a expiré. Veuillez relancer la connexion d’entreprise.
            </p>
            <button type="button" className="btn btn-primary" onClick={connexionSso} style={{ width: '100%', height: 44 }}>
              {t.authRetry || 'Réessayer la connexion'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PortalLoader
      messages={[
        t.loaderAuth1 || 'Vérification du jeton de sécurité…',
        t.loaderAuth2 || 'Résolution des rôles et du périmètre en base…',
        t.loaderAuth3 || 'Chargement de votre tableau de bord…',
      ]}
    />
  )
}
