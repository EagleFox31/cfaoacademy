import { useEffect, useRef, useState } from 'react'

/**
 * Les photos du brouillon, telles que le service d'apercu les connait.
 *
 * Le navigateur tient ses photos sous des adresses `blob:` que le
 * service ne peut pas lire. Chaque photo lui est donc envoyee une fois,
 * des qu'elle apparait dans le brouillon ; il la reduit, la garde et
 * renvoie un identifiant. Les apercus n'echangent ensuite que cet
 * identifiant.
 *
 * Renvoie la table `id de la photo -> identifiant du service`. Une photo
 * en cours d'envoi n'y figure pas encore ; son arrivee change la table,
 * donc les valeurs, donc l'apercu.
 */
export function useRefsPhotos(photosParRubrique) {
  const [refs, setRefs] = useState({})
  const envoyees = useRef(new Set())

  useEffect(() => {
    const toutes = Object.values(photosParRubrique || {}).flat()
    toutes.forEach(async p => {
      if (!p?.apercu || envoyees.current.has(p.id)) return
      envoyees.current.add(p.id)
      try {
        const image = await (await fetch(p.apercu)).blob()
        const r = await fetch('/apercu/photo', { method: 'POST', body: image })
        if (!r.ok) throw new Error(String(r.status))
        const { id } = await r.json()
        setRefs(avant => ({ ...avant, [p.id]: id }))
      } catch {
        // Service arrete ou image illisible : on retentera au prochain
        // changement plutot que de bloquer l'apercu.
        envoyees.current.delete(p.id)
      }
    })
  }, [photosParRubrique])

  return refs
}
