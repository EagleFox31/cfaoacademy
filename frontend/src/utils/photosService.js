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
      if (!p?.id || envoyees.current.has(p.id)) return
      // Deja conservee par le serveur (brouillon repris, autre poste) :
      // son identifiant suffit, rien a renvoyer.
      if (p.ref) {
        envoyees.current.add(p.id)
        setRefs(avant => ({ ...avant, [p.id]: p.ref }))
        return
      }
      if (!p.apercu) return
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

/** L'adresse d'une photo conservee par le serveur. */
export const adressePhoto = ref => `/apercu/photos/${ref}.jpg`

/**
 * Inscrit dans le brouillon l'identifiant serveur des photos envoyees.
 *
 * Tant qu'une photo n'est designee que par une adresse `blob:`, elle
 * n'existe que dans cet onglet : le brouillon enregistre la perdrait, et
 * un autre poste ne la verrait jamais. Une fois envoyee, elle prend son
 * identifiant et l'adresse servie par le serveur.
 *
 * Renvoie le patch a appliquer au brouillon, ou `null` si rien ne change.
 */
export function ancrerPhotos(b, refs) {
  let change = false
  const ancrer = p => {
    if (!p?.id || p.ref || !refs[p.id]) return p
    change = true
    return { ...p, ref: refs[p.id], apercu: adressePhoto(refs[p.id]) }
  }
  const photos = Object.fromEntries(Object.entries(b.photos || {})
    .map(([rubrique, liste]) => [rubrique, (liste || []).map(ancrer)]))
  const formateurs = (b.formateurs || []).map(f =>
    (f?.portrait ? { ...f, portrait: ancrer(f.portrait) } : f))
  const photoGroupe = b.photoGroupe ? ancrer(b.photoGroupe) : b.photoGroupe
  if (!change) return null
  return {
    photos,
    ...(b.formateurs ? { formateurs } : {}),
    ...(b.photoGroupe ? { photoGroupe } : {}),
  }
}
