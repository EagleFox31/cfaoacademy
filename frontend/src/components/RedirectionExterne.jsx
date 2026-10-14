import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { adresseComptesRendus } from '../utils/urlComptesRendus'

/**
 * Renvoie vers le module des comptes rendus, hébergé à part : l'adresse
 * demandée (chemin, query, ancre) est reprise telle quelle, de sorte qu'un
 * ancien lien `/portail/compte-rendu/nouveau?session=…` arrive sur la bonne page.
 *
 * `aller` n'est surchargé que par les tests.
 */
export default function RedirectionExterne({ aller = adresse => window.location.replace(adresse) }) {
  const lieu = useLocation()
  const adresse = adresseComptesRendus(lieu)

  useEffect(() => { aller(adresse) }, [adresse, aller])

  return (
    <p style={{ padding: '48px 32px', textAlign: 'center' }}>
      Les comptes rendus ont leur propre espace.{' '}
      <a href={adresse}>Ouvrir les comptes rendus</a>
    </p>
  )
}
