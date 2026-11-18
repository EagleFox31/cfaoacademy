import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { adressePortail } from '../lib/portail'

/** Écran de repli sans portail (module servi seul) : la liste à documenter. */
const REPLI = '/portail/compte-rendu/a-documenter'

/**
 * Racine du module : l'accueil formateur est celui du portail, on y renvoie
 * (avec l'ancre demandée). Sans portail, on ouvre la liste à documenter.
 */
export default function VersPortail() {
  const { hash } = useLocation()
  const cible = adressePortail(hash)

  useEffect(() => {
    if (cible) window.location.replace(cible)
  }, [cible])

  return cible ? null : <Navigate to={REPLI} replace />
}
