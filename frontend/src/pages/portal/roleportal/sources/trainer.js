import { useMemo } from 'react'
import { sessionsDuFormateur } from '../../../../data/mock_sessions_formateur.js'
import { TICKETS_ASSISTANCE_DEMO } from '../../../../data/mock_assistance_formateur.js'
import { sessionsAVenir } from '../../../../utils/sessionsAVenir.js'
import { filterTicketsForBrands, resolveUserDisplayName } from '../../../../utils/assistanceTickets.js'
import { marquesDuFormateur } from '../../../../utils/catalogFormateur.js'

const aVenirDe = user => sessionsAVenir(sessionsDuFormateur(user))

/** Marques que ce formateur couvre (équipe des pôles). */
export const marquesDe = user => marquesDuFormateur(resolveUserDisplayName(user))

/** Demandes des techniciens sur les marques que ce formateur couvre. */
export const assistanceDu = user => filterTicketsForBrands(TICKETS_ASSISTANCE_DEMO, marquesDe(user))

/** Sélecteurs synchrones du formateur : la page et la navbar s'en servent. */
export const trainerSelectors = {
  aVenir: ctx => aVenirDe(ctx.user).length > 0,
}

/** Données du portail formateur (mock des sessions et des demandes d'assistance). */
export function useTrainerSources(ctx) {
  const { user } = ctx
  return useMemo(() => {
    const aVenir = aVenirDe(user)
    return { values: { aVenir, marques: marquesDe(user), assistance: assistanceDu(user) }, loading: false }
  }, [user])
}
