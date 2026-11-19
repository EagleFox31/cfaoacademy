import { useEffect, useState } from 'react'
import { getPrimaryRole } from '../data/index.js'

const EN_COURS = Object.freeze({ etat: 'loading', pays: null, marques: [] })

/**
 * Fiche du formateur connecté dans le planning : pays où il est basé et marques
 * qu'il forme. Seulement pour le rôle formateur ; sinon `null`.
 * Renvoie `{ etat: 'loading' | 'ready' | 'error', pays, marques }`. Sans fiche
 * reliée au compte : `ready` avec `pays: null` et aucune marque (l'écran
 * affiche « Non renseigné »), jamais de valeur inventée.
 */
export default function useMaFicheFormateur(user) {
  const formateur = Boolean(user) && getPrimaryRole(user.roles) === 'trainer'
  const [fiche, setFiche] = useState(null)

  useEffect(() => {
    if (!formateur) { setFiche(null); return undefined }
    let actif = true
    setFiche(EN_COURS)
    import('../lib/planningApi.js')
      .then(({ planningApi }) => planningApi.myTrainer())
      .then(r => {
        if (!actif) return
        const t = r?.linked ? r.trainer : null
        setFiche({ etat: 'ready', pays: t?.country?.label ?? null, marques: t?.brands ?? [] })
      })
      .catch(() => { if (actif) setFiche({ etat: 'error', pays: null, marques: [] }) })
    return () => { actif = false }
  }, [formateur])

  return formateur ? (fiche ?? EN_COURS) : null
}
