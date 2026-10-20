import useCountUp from '../../../hooks/useCountUp.js'

const DEFINE_COUNT_UP_DURATION = 1600

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Nombre animé — démarrage immédiat, relance via `restartKey` (filtres Define). */
export default function DefineAnimatedNumber({
  value,
  className,
  duration = DEFINE_COUNT_UP_DURATION,
  delay = 0,
  restartKey,
  pad = 0,
  suffix = '',
}) {
  const target = Number.isFinite(value) ? value : 0
  const motionDuration = prefersReducedMotion() ? 0 : duration
  const display = useCountUp(target, {
    duration: motionDuration,
    start: true,
    delay,
    restartKey,
  })

  const formatted = pad > 0
    ? String(display).padStart(pad, '0')
    : String(display)

  return (
    <span className={className} aria-label={String(target)}>
      {formatted}
      {suffix}
    </span>
  )
}

export function defineCountUpDuration() {
  return prefersReducedMotion() ? 0 : DEFINE_COUNT_UP_DURATION
}
