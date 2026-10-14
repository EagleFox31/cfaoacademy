import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import useEnHautDePage from '../hooks/useEnHautDePage'
import { useAuth } from '../lib/auth'

const MOTIFS = {
  INVALID_CREDENTIALS: 'Identifiant ou mot de passe incorrect.',
  NETWORK: 'Le service des comptes rendus ne répond pas. Réessayez dans un instant.',
  GENERIC: 'La connexion a échoué. Réessayez, ou contactez votre administrateur.',
}

export default function Connexion() {
  useEnHautDePage('Connexion')
  const { user, connexion } = useAuth()
  const naviguer = useNavigate()
  const lieu = useLocation()
  const retour = lieu.state?.retour || '/'

  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [seSouvenir, setSeSouvenir] = useState(false)
  const [motif, setMotif] = useState(null)
  const [envoi, setEnvoi] = useState(false)

  if (user) return <Navigate to={retour} replace />

  async function envoyer(e) {
    e.preventDefault()
    if (!identifiant.trim() || !motDePasse) {
      setMotif('Saisissez votre identifiant et votre mot de passe.')
      return
    }
    setMotif(null)
    setEnvoi(true)
    const refus = await connexion(identifiant, motDePasse, seSouvenir)
    setEnvoi(false)
    if (refus) setMotif(MOTIFS[refus] || MOTIFS.GENERIC)
    else naviguer(retour, { replace: true })
  }

  return (
    <main className="connexion">
      <form className="connexion-carte" onSubmit={envoyer} noValidate>
        <div className="brand connexion-marque">
          <img src="/assets/logo-cfao-mobility.jpg" alt="cfao mobility" className="brand-mark" />
          <div className="brand-label">Academy<span>.</span></div>
        </div>
        <h1 className="connexion-titre">Comptes rendus de formation</h1>
        <p className="connexion-aide">Connectez-vous avec votre compte formateur.</p>

        <label className="connexion-champ">
          <span>Identifiant</span>
          <input type="text" autoComplete="username" autoFocus value={identifiant}
            onChange={e => setIdentifiant(e.target.value)} />
        </label>
        <label className="connexion-champ">
          <span>Mot de passe</span>
          <input type="password" autoComplete="current-password" value={motDePasse}
            onChange={e => setMotDePasse(e.target.value)} />
        </label>
        <label className="connexion-souvenir">
          <input type="checkbox" checked={seSouvenir}
            onChange={e => setSeSouvenir(e.target.checked)} />
          <span>Rester connecté sur ce poste</span>
        </label>

        {motif && <p className="connexion-erreur" role="alert">{motif}</p>}

        <button type="submit" className="connexion-envoi" disabled={envoi}>
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </main>
  )
}
