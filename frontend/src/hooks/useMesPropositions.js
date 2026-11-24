import { useCallback, useEffect, useMemo, useState } from 'react'
import { peutProposer } from '../components/ProposerModification.jsx'
import { api } from '../lib/api'
import { PROPOSITION_CREEE } from '../utils/typesProposition.js'
import { aUnChangement, cleChangement, statutDe } from '../utils/etapesProposition.js'
import { PAGE_MES_PROPOSITIONS } from '../utils/planningAccess.js'

export { PAGE_MES_PROPOSITIONS }

/** Changements d'étape déjà vus, par compte (confort local, sans enjeu). */
const cleVues = id => `cfao-propositions-vues:${id}`
const PROPOSITIONS_VUES = 'cfao-propositions-vues'
const VUES_MAX = 200

function lireVues(id) {
  try {
    const cles = JSON.parse(localStorage.getItem(cleVues(id)) || '[]')
    return new Set(Array.isArray(cles) ? cles : [])
  } catch {
    return new Set()
  }
}

const MESSAGE_MAX = 90

/**
 * Alertes de la cloche, précédées des changements d'étape pas encore vus
 * (un par proposition). L'ouvrir le marque vu et mène au suivi (`voir`).
 * Pas de cloche (null) : rien n'est ajouté.
 */
export function alertesAvecPropositions(alertes, nouvelles, t, marquerVues, voir) {
  if (alertes == null || !nouvelles?.length) return alertes
  return [
    ...nouvelles.map(p => ({
      id: `proposition-${p.id}`,
      label: t[`propositions_notif_${statutDe(p)}`] ?? t.propositions_notif_titre,
      text: p.message.length > MESSAGE_MAX ? `${p.message.slice(0, MESSAGE_MAX - 1)}…` : p.message,
      cta: t.propositions_notif_vu,
      onOpen: () => { marquerVues([p]); voir?.() },
    })),
    ...alertes,
  ]
}

/**
 * Propositions de modification envoyées par le compte connecté, et celles dont
 * l'étape a changé depuis la dernière visite (compteur du menu, notification
 * de la cloche). `liste` : undefined pendant le chargement, null si indisponible.
 */
export default function useMesPropositions(user) {
  const id = user?.id
  const actif = Boolean(id) && peutProposer(user?.roles)
  const [liste, setListe] = useState(undefined)
  const [vues, setVues] = useState(() => new Set())

  useEffect(() => {
    if (!actif) {
      setListe(undefined)
      return undefined
    }
    setVues(lireVues(id))
    let vivant = true
    const charger = () => api.suggestions.miennes()
      .then(l => { if (vivant) setListe(Array.isArray(l) ? l : []) })
      .catch(() => { if (vivant) setListe(null) })
    // Vu ailleurs (page de suivi, autre instance du hook) : relire.
    const relireVues = () => { if (vivant) setVues(lireVues(id)) }
    charger()
    window.addEventListener(PROPOSITION_CREEE, charger)
    window.addEventListener(PROPOSITIONS_VUES, relireVues)
    return () => {
      vivant = false
      window.removeEventListener(PROPOSITION_CREEE, charger)
      window.removeEventListener(PROPOSITIONS_VUES, relireVues)
    }
  }, [actif, id])

  const nouvelles = useMemo(
    () => (liste ?? []).filter(p => aUnChangement(p) && !vues.has(cleChangement(p))),
    [liste, vues],
  )

  /** Marque vus les changements actuels de ces propositions. */
  const marquerVues = useCallback(propositions => {
    if (!actif || !propositions?.length) return
    const apres = new Set([...lireVues(id), ...propositions.map(cleChangement)])
    try { localStorage.setItem(cleVues(id), JSON.stringify([...apres].slice(-VUES_MAX))) } catch { /* stockage indisponible */ }
    setVues(apres)
    window.dispatchEvent(new Event(PROPOSITIONS_VUES))
  }, [actif, id])

  return { actif, liste, nouvelles, marquerVues }
}
