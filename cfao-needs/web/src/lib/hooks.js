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
  const [state, setState] = useState('idle') // idle | saving | saved | error
  const pending = useRef(new Map())
  const timer = useRef(null)

  const flush = useCallback(async () => {
    if (pending.current.size === 0) return
    const rows = [...pending.current.values()]
    pending.current.clear()
    setState('saving')
    try {
      await save(rows)
      setState('saved')
    } catch {
      setState('error')
      // On rend les lignes à la file : la prochaine frappe retentera l'envoi.
      rows.forEach((row) => pending.current.set(row.catalog_line, row))
    }
  }, [save])

  const queue = useCallback(
    (row) => {
      pending.current.set(row.catalog_line, row)
      setState('saving')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, delay)
    },
    [flush, delay],
  )

  // Une fermeture d'onglet ne doit pas emporter la dernière frappe.
  useEffect(() => {
    const onHide = () => {
      if (pending.current.size > 0) flush()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [flush])

  return { queue, flush, state }
}
