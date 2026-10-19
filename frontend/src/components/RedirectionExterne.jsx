import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { adresseComptesRendus } from '../utils/urlComptesRendus'

/** Vrai si l'adresse visée est la page courante du portail (même origine, même chemin). */
function bouclerait(adresse, lieu, origine) {
  try {
    const cible = new URL(adresse)
    return cible.origin === origine && cible.pathname === lieu.pathname
  } catch {
    return false
  }
}

/**
 * Renvoie vers le module des comptes rendus, hébergé à part : l'adresse
 * demandée (chemin, query, ancre) est reprise telle quelle, de sorte qu'un
 * ancien lien `/portail/compte-rendu/nouveau?session=…` arrive sur la bonne page.
 *
 * Garde contre la boucle : si VITE_CR_URL a la même origine que le portail et
 * ne change pas le chemin, l'adresse visée est cette page même ; on affiche le
 * lien sans rediriger.
 *
 * `aller` et `origine` ne sont surchargés que par les tests.
 */
export default function RedirectionExterne({
  aller = adresse => window.location.replace(adresse),
  origine = window.location.origin,
}) {
  const lieu = useLocation()
  const adresse = adresseComptesRendus(lieu)
  const boucle = bouclerait(adresse, lieu, origine)

  useEffect(() => { if (!boucle) aller(adresse) }, [adresse, aller, boucle])

  return (
    <p style={{ padding: '48px 32px', textAlign: 'center' }}>
      Les comptes rendus ont leur propre espace.{' '}
      <a href={adresse}>Ouvrir les comptes rendus</a>
    </p>
  )
}
