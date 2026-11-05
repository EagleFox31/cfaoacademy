import { useEffect, useState } from 'react'

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}

/** Compte de 0 → target quand `start` passe à true. `restartKey` relance l'anim même si la cible est inchangée. */
export default function useCountUp(target, { duration = 1200, start = false, delay = 0, restartKey } = {}) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!start || target == null) {
      setValue(0)
      return undefined
    }

    let raf
    const timeout = window.setTimeout(() => {
      if (duration <= 0) {
        setValue(target)
        return
      }
      const t0 = performance.now()
      const run = now => {
        const t = Math.min(1, (now - t0) / duration)
        setValue(Math.round(target * easeOutCubic(t)))
        if (t < 1) raf = requestAnimationFrame(run)
        else setValue(target)
      }
      raf = requestAnimationFrame(run)
    }, delay)

    return () => {
      window.clearTimeout(timeout)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [target, duration, start, delay, restartKey])

  return value
}
