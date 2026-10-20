import { useEffect, useRef, useState } from 'react'
import useCountUp from '../hooks/useCountUp.js'

/** Nombre animé au scroll (count-up). */
export default function AnimatedCount({
  value,
  className,
  duration = 1200,
  delay = 0,
}) {
  const ref = useRef(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStarted(true)
      return undefined
    }

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setStarted(true)
        io.disconnect()
      }
    }, { threshold: 0.25, rootMargin: '0px 0px -8% 0px' })

    io.observe(el)
    return () => io.disconnect()
  }, [])

  const motionDuration = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : duration

  const display = useCountUp(value, { duration: motionDuration, start: started, delay })

  return (
    <span ref={ref} className={className} aria-label={String(value)}>
      {display}
    </span>
  )
}
