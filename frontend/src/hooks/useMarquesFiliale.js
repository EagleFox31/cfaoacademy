import { useEffect, useState } from 'react'
import { resolveMedacapUserQuery } from '../utils/medacapConfig.js'
import { fetchDpsScope } from '../utils/medacapDpsScopeApi.js'

/**
 * Nombre de marques de la filiale de l'utilisateur, lu uniquement dans
 * MEDACAP (même appel rapide que le DPS, sans insights ni PIF).
 * Jamais de jeu de démo : MEDACAP coupé, compte inconnu, réponse vide ou en
 * cours → null (l'écran affiche « — »).
 */
export default function useMarquesFiliale(user) {
  const userId = user?.medacapUserId
  const username = user?.medacapUsername
  const email = user?.medacapEmail
  const [marques, setMarques] = useState(null)

  useEffect(() => {
    const query = resolveMedacapUserQuery({ medacapUserId: userId, medacapUsername: username, medacapEmail: email })
    setMarques(null)
    if (!query) return undefined
    let annule = false
    fetchDpsScope(query, { insights: false, pif: false })
      .then(scope => { if (!annule && scope?.brands?.length) setMarques(scope.brands.length) })
      .catch(() => {})
    return () => { annule = true }
  }, [userId, username, email])

  return marques
}
