import { useCallback, useEffect, useRef, useState } from 'react'

/** Chargement asynchrone avec états explicites — pas de spinner infini muet. */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })
  const alive = useRef(true)

  const run = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }))
    Promise.resolve(fn())
      .then((data) => alive.current && setState({ status: 'ready', data, error: null }))
      .catch((error) => alive.current && setState({ status: 'error', data: null, error }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    alive.current = true
    run()
    return () => {
      alive.current = false
    }
  }, [run])

  return { ...state, reload: run, setData: (data) => setState({ status: 'ready', data, error: null }) }
}

/**
 * Enregistrement différé du brouillon.
 *
 * Le brouillon vit **côté serveur**, pas seulement dans le navigateur : c'est le
 * correctif du principe 4 d'Academix, où le `localStorage` était la source de
 * vérité et où un poste changé perdait la saisie.
 */
export function useDebouncedSave(save, delay = 800) {
  // `dirty` et `saving` sont DEUX états distincts, et les confondre a produit un
  // vrai incident : le témoin affichait « Enregistrement… » dès la frappe, donc
  // pendant toute la fenêtre de temporisation — et indéfiniment tant que l'on
  // tape, puisque chaque frappe relance le minuteur. Quelqu'un qui actualisait
  // à ce moment perdait sa saisie alors que l'écran affirmait le contraire.
  //
  // Désormais : `dirty` = en attente d'envoi (rien n'est parti), `saving` =
  // requête réellement en vol.
  const [state, setState] = useState('idle') // idle | dirty | saving | saved | error
  const pending = useRef(new Map())
  const timer = useRef(null)

  const flush = useCallback(
    async ({ keepalive = false } = {}) => {
      if (pending.current.size === 0) return
      const rows = [...pending.current.values()]
      pending.current.clear()
      setState('saving')
      try {
        await save(rows, { keepalive })
        setState('saved')
      } catch {
        setState('error')
        // On rend les lignes à la file : la prochaine frappe retentera l'envoi.
        rows.forEach((row) => pending.current.set(row.catalog_line, row))
      }
    },
    [save],
  )

  const queue = useCallback(
    (row) => {
      pending.current.set(row.catalog_line, row)
      setState('dirty')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, delay)
    },
    [flush, delay],
  )

  // Sortie de page : `keepalive` laisse la requête vivre au-delà du document.
  // Sans lui, le navigateur annule le `fetch` au rechargement — le filet de
  // sécurité ne rattrapait rien.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && pending.current.size > 0) {
        flush({ keepalive: true })
      }
    }
    // `beforeunload` : dernier rempart. Le navigateur affiche sa propre
    // confirmation ; on ne peut pas la personnaliser, mais elle évite de perdre
    // une saisie sur un F5 réflexe.
    const onBeforeUnload = (event) => {
      if (pending.current.size === 0) return undefined
      flush({ keepalive: true })
      event.preventDefault()
      event.returnValue = ''
      return ''
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [flush])

  return { queue, flush, state }
}

/** True tant que l'élément est (partiellement) dans le viewport. */
export function useElementVisible(ref, { threshold = 0, rootMargin = '0px' } = {}) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold, rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, threshold, rootMargin])

  return visible
}

