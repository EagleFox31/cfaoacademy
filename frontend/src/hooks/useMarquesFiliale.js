import { useEffect, useState } from 'react'
import { resolveMedacapUserQuery } from '../utils/medacapConfig.js'
import { fetchDpsScope } from '../utils/medacapDpsScopeApi.js'

const INCONNUS = { marques: null, techniciens: null }

/** Nombre > 0, sinon null (« — ») : un zéro de MEDACAP veut dire « pas de donnée ». */
const positif = n => (Number.isFinite(n) && n > 0 ? n : null)

/**
 * Marques et techniciens de la filiale de l'utilisateur, lus uniquement dans
 * MEDACAP (même appel rapide que le DPS, sans insights ni PIF ; techniciens
 * comptés comme le hero DPS). Jamais de jeu de démo : MEDACAP coupé, compte
 * inconnu, réponse vide ou en cours → null (l'écran affiche « — »).
 */
export function useChiffresFiliale(user) {
  const userId = user?.medacapUserId
  const username = user?.medacapUsername
  const email = user?.medacapEmail
  const [chiffres, setChiffres] = useState(INCONNUS)

  useEffect(() => {
    const query = resolveMedacapUserQuery({ medacapUserId: userId, medacapUsername: username, medacapEmail: email })
    setChiffres(INCONNUS)
    if (!query) return undefined
    let annule = false
    fetchDpsScope(query, { insights: false, pif: false })
      .then(scope => {
        if (annule || !scope) return
        setChiffres({
          marques: positif(scope.brands?.length),
          techniciens: positif(scope.technicians?.length || Number(scope.kpis?.totalTechnicians)),
        })
      })
      .catch(() => {})
    return () => { annule = true }
  }, [userId, username, email])

  return chiffres
}

/** Nombre de marques seul (RH filiale, admin filiale). */
export default function useMarquesFiliale(user) {
  return useChiffresFiliale(user).marques
}
