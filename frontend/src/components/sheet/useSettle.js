import { useEffect, useRef, useState } from 'react'

/**
 * Vrai pendant `ms` après chaque changement de `deps` (jamais au montage).
 * Un filtre, un tri ou une recherche locale est instantané : ce bref état laisse
 * voir un squelette, comme pour un chargement serveur. Sûr en StrictMode (le
 * minuteur vit dans une ref, pas dans le nettoyage de l'effet rejoué).
 */
export function useSettle(deps, ms = 320) {
  const [busy, setBusy] = useState(false)
  const prev = useRef(deps)
  const timer = useRef(null)

  useEffect(() => {
    const changed = deps.length !== prev.current.length
      || deps.some((d, i) => !Object.is(d, prev.current[i]))
    prev.current = deps
    if (!changed) return
    setBusy(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setBusy(false), ms)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timer.current), [])
  return busy
}
