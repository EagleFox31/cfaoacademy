import { useCallback, useContext, useMemo, useState } from 'react'
import { AuthContext } from '../context/sessionContext.js'
import useLocale from '../hooks/useLocale'
import {
  lireApercu,
  peutOuvrirApercu,
  quitterApercu,
  utilisateurApercu,
  verrouillerEcritures,
} from '../utils/apercuPortail.js'

/**
 * Fenêtre d'aperçu du super admin (utils/apercuPortail.js) : toute l'application
 * y lit le compte avec le seul rôle de l'aperçu, les écritures sont refusées et
 * un bandeau rappelle ce qu'on regarde. Hors aperçu, ou pour un autre compte
 * que le super admin, rien ne change.
 */
export default function ApercuProvider({ children }) {
  const session = useContext(AuthContext)
  const [role, setRole] = useState(() => lireApercu())
  const reel = session?.user
  const actif = Boolean(role && reel && peutOuvrirApercu(reel.roles))

  // Posé dès le rendu, pas dans un effet : les effets des écrans enfants
  // passent avant ceux de ce composant et pourraient écrire avant le verrou.
  basculerVerrou(actif)

  // Fermer l'aperçu ne touche pas à la session : le super admin reste
  // connecté dans sa fenêtre principale.
  const fermer = useCallback(() => {
    quitterApercu()
    setRole(null)
    window.close()
  }, [])

  // Dans l'aperçu, « Déconnexion » (menu, barre démo, nav mobile) ferme
  // l'aperçu au lieu de déconnecter le vrai compte.
  const valeur = useMemo(
    () => (actif ? { ...session, user: utilisateurApercu(reel, role), logout: fermer } : session),
    [actif, session, reel, role, fermer],
  )

  return (
    <AuthContext.Provider value={valeur}>
      {children}
      {actif && <BandeauApercu role={role} onFermer={fermer} />}
    </AuthContext.Provider>
  )
}

let rendreFetch = null

function basculerVerrou(actif) {
  if (actif && !rendreFetch) rendreFetch = verrouillerEcritures()
  else if (!actif && rendreFetch) {
    rendreFetch()
    rendreFetch = null
  }
}

function BandeauApercu({ role, onFermer }) {
  const { t } = useLocale('portal')
  return (
    <div className="portal-apercu-bandeau" role="status">
      <span>
        {t.apercu_bandeau} <strong>{t[`role_${role}`] ?? role}</strong>
        <span className="portal-apercu-bandeau-note"> · {t.apercu_bandeau_note}</span>
      </span>
      <button type="button" className="portal-btn portal-btn-ghost" onClick={onFermer}>
        {t.apercu_fermer}
      </button>
    </div>
  )
}
