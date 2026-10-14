import { NavLink, useNavigate } from 'react-router-dom'

import { useAuth } from '../lib/auth'

const LIENS = [
  { vers: '/', libelle: 'Accueil', exact: true },
  { vers: '/portail/compte-rendu/en-cours', libelle: 'En cours' },
  { vers: '/portail/compte-rendu/mes-rapports', libelle: 'Mes rapports' },
]

/** La barre du haut : la marque, les trois entrées du module, le compte. */
export default function AppShell({ children }) {
  const { user, logout } = useAuth()
  const naviguer = useNavigate()

  function deconnecter() {
    logout()
    naviguer('/connexion', { replace: true })
  }

  return (
    <>
      <header className="shell">
        <div className="shell-barre">
          <NavLink to="/" className="brand shell-marque" aria-label="CFAO Academy, accueil">
            <img src="/assets/logo-cfao-mobility.jpg" alt="cfao mobility" className="brand-mark" />
            <div className="brand-label">Academy<span>.</span></div>
          </NavLink>

          <nav className="shell-liens" aria-label="Comptes rendus">
            {LIENS.map(l => (
              <NavLink key={l.vers} to={l.vers} end={l.exact}
                className={({ isActive }) => `shell-lien${isActive ? ' actif' : ''}`}>
                {l.libelle}
              </NavLink>
            ))}
          </nav>

          <div className="shell-compte">
            {user && <span className="shell-nom">{user.firstName} {user.lastName}</span>}
            <button type="button" className="shell-sortie" onClick={deconnecter}>
              Déconnexion
            </button>
          </div>
        </div>
      </header>
      {children}
    </>
  )
}
