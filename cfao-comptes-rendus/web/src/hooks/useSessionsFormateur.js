import { useCallback, useEffect, useRef, useState } from 'react'
import { chargerSessions, FILTRES_VIDES, SOURCE_ESSAI } from '../data/sessionsReferentiel'
import { fusionnerOptions, OPTIONS_VIDES } from '../utils/filtresSessions'

// Le dernier resultat sans filtre, par compte : l'accueil, la barre du
// haut et l'assistant se montent l'un apres l'autre, aucun n'a a repartir
// d'une liste vide.
let memoire = null

/** Efface la memoire (changement de compte, tests). */
export function oublierSessions() { memoire = null }

const DELAI_RECHERCHE = 250

/**
 * Les sessions du formateur, d'apres la source decidee par
 * `data/sessionsReferentiel`.
 *
 * `sessions` garde la derniere liste connue pendant un rechargement ;
 * `options` cumule les pays, marques et formateurs deja rencontres ;
 * `erreur` porte un message lisible quand le referentiel est renseigne
 * mais ne repond pas.
 */
export default function useSessionsFormateur(user, filtres = FILTRES_VIDES) {
  const compte = user?.id ?? null
  const sansFiltre = Object.values(filtres).every(v => !String(v ?? '').trim())
  const depart = sansFiltre && memoire?.compte === compte ? memoire : null
  const [etat, setEtat] = useState({
    sessions: depart?.sessions ?? [],
    source: depart?.source ?? null,
    chargement: !depart,
    erreur: null,
    options: depart?.options ?? fusionnerOptions(OPTIONS_VIDES, depart?.sessions),
  })
  const [relance, setRelance] = useState(0)
  const cleFiltres = JSON.stringify(filtres)
  const dernierFiltres = useRef(filtres)
  dernierFiltres.current = filtres

  useEffect(() => {
    if (!user) {
      setEtat({ sessions: [], source: null, chargement: false, erreur: null, options: OPTIONS_VIDES })
      return undefined
    }
    let actif = true
    setEtat(e => ({ ...e, chargement: true, erreur: null }))
    const demande = () => chargerSessions(dernierFiltres.current, user)
      .then(({ source, sessions }) => {
        if (!actif) return
        setEtat(prec => {
          const options = fusionnerOptions(prec.options, sessions)
          if (sansFiltre) memoire = { compte, source, sessions, options }
          return { sessions, source, chargement: false, erreur: null, options }
        })
      })
      .catch(e => {
        if (!actif) return
        setEtat(prec => ({ ...prec, chargement: false, erreur: e?.message || 'Les sessions ne se chargent pas.' }))
      })
    const minuteur = setTimeout(demande, sansFiltre ? 0 : DELAI_RECHERCHE)
    return () => { actif = false; clearTimeout(minuteur) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compte, cleFiltres, relance])

  const recharger = useCallback(() => setRelance(n => n + 1), [])
  return { ...etat, essai: etat.source === SOURCE_ESSAI, recharger }
}
