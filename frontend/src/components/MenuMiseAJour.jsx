import { useState, useSyncExternalStore } from 'react'
import useLocale from '../hooks/useLocale.js'
import { abonnerOffre, actualiser, lireOffre, rechercherMiseAJour } from '../lib/miseAJour.js'

/** Offre de mise à jour en cours (null si aucune), partagée avec la barre du haut. */
export function useOffreMiseAJour() {
  return useSyncExternalStore(abonnerOffre, lireOffre, lireOffre)
}

function IconeActualiser({ size = 16, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Option du menu du compte : « Rechercher des mises à jour » à la demande, ou
 * « Mise à jour disponible · Actualiser » tant qu'une version attend (même après
 * « Plus tard » sur la barre du haut).
 */
export default function MenuMiseAJour({ variant = 'desktop', url, locale, faireFetch, recharger }) {
  const { t } = useLocale('miseAJour')
  const offre = useOffreMiseAJour()
  const [etat, setEtat] = useState(null) // null | 'recherche' | 'a-jour' | 'echec'
  const mobile = variant === 'mobile'
  const classe = `${mobile ? 'nav-mobile-foot-link nav-user-menu-option' : 'nav-user-dropdown-item'} nv-menu`

  if (offre) {
    return (
      <button type="button" className={`${classe} nv-menu--dispo`} role={mobile ? undefined : 'menuitem'}
        onClick={() => actualiser(recharger ? { recharger } : undefined)}>
        <IconeActualiser className="nav-user-dropdown-item-icon" />
        <span className="nav-user-dropdown-item-label">{t.menuDisponible}</span>
        <span className="nv-menu-cta">{t.menuActualiser}</span>
      </button>
    )
  }

  const rechercher = async () => {
    setEtat('recherche')
    const r = await rechercherMiseAJour({ url, locale, faireFetch })
    setEtat(r === 'disponible' ? null : r)
  }
  const message = etat === 'a-jour' ? t.menuAJour : etat === 'echec' ? t.menuEchec : ''

  return (
    <div className="nav-user-dropdown-group">
      <button type="button" className={classe} role={mobile ? undefined : 'menuitem'}
        onClick={rechercher} disabled={etat === 'recherche'} aria-busy={etat === 'recherche'}>
        <IconeActualiser className={`nav-user-dropdown-item-icon${etat === 'recherche' ? ' nv-menu-tourne' : ''}`} />
        <span className="nav-user-dropdown-item-label">
          {etat === 'recherche' ? t.menuRecherche : t.menuRechercher}
        </span>
      </button>
      <p className="nv-menu-message" role="status">{message}</p>
    </div>
  )
}
