import { useEffect, useMemo, useState } from 'react'
import { aujourdhui } from '../../../../utils/sessionsAVenir.js'
import { resolveUserDisplayName } from '../../../../utils/assistanceTickets.js'
import { marquesDuFormateur } from '../../../../utils/catalogFormateur.js'

/** Marques que ce formateur couvre (équipe des pôles). */
export const marquesDe = user => marquesDuFormateur(resolveUserDisplayName(user))

/** « MOTORS » → « Motors » : la clé de `VISUEL_POLE`. */
const pole = p => (p ? p[0] + p.slice(1).toLowerCase() : '')

/**
 * Une session du planning (`GET /me/sessions`) au format des cartes du
 * formateur. Les inscrits ne viennent pas du planning : `participants`
 * reste `null` (nombre non affiché plutôt qu'un zéro faux).
 */
export function sessionDuPlanning(s, jour = aujourdhui()) {
  const debut = s.start_date
  const fin = s.end_date || s.start_date
  return {
    id: s.id,
    moduleFormation: s.title || s.code,
    marque: s.brand || s.brand_code,
    pole: pole(s.pole),
    debut,
    fin,
    lieu: s.location || s.country_label,
    statut: debut && debut <= jour && fin >= jour ? 'en_cours' : 'a_venir',
    participants: null,
  }
}

/**
 * État de la section « Vos prochaines sessions » :
 * `loading` · `error` · `unlinked` (compte pas relié à une fiche) · `ready`.
 */
export function etatSessions(reponse, erreur) {
  if (erreur) return { etat: 'error', sessions: [] }
  if (!reponse) return { etat: 'loading', sessions: [] }
  if (!reponse.linked) return { etat: 'unlinked', sessions: [] }
  return { etat: 'ready', sessions: (reponse.sessions ?? []).map(s => sessionDuPlanning(s)) }
}

/** Sélecteurs synchrones du formateur (navbar) : aucun, la section de ses sessions est toujours là. */
export const trainerSelectors = {}

/** Données du portail formateur : sessions du planning et marques couvertes. */
export function useTrainerSources(ctx) {
  const { user } = ctx
  const [reponse, setReponse] = useState(null)
  const [erreur, setErreur] = useState(null)

  // Une lecture par connexion : l'objet `user` peut changer sans que le compte change.
  const connecte = Boolean(user)
  useEffect(() => {
    if (!connecte) return undefined
    let actif = true
    setReponse(null)
    setErreur(null)
    // Import différé : la navbar (`data/index.js`) charge ce module hors
    // navigateur, et `lib/auth.js` touche `document` dès son chargement.
    import('../../../../lib/planningApi.js')
      .then(({ planningApi }) => planningApi.mySessions())
      .then(r => { if (actif) setReponse(r) })
      .catch(e => { if (actif) setErreur(e) })
    return () => { actif = false }
  }, [connecte])

  return useMemo(() => {
    const sessions = etatSessions(reponse, erreur)
    return {
      values: { sessions, marques: marquesDe(user) },
      loading: sessions.etat === 'loading',
    }
  }, [user, reponse, erreur])
}
