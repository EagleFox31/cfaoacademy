import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const DEFAULT_PADDING = 10
const NAV_CLEARANCE = 84
const VIEWPORT_MARGIN = 12

const NAV_TARGET_SELECTORS = new Set(['[data-portal-help]', '[data-portal-locale]'])

function isNavBarTarget(selector) {
  return NAV_TARGET_SELECTORS.has(selector)
}

function scrollToSection(id, scrollToTop = false) {
  if (scrollToTop) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  if (!id) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  const el = document.getElementById(id)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - NAV_CLEARANCE
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

function resolveTargetElement(selector) {
  if (isNavBarTarget(selector)) {
    const nodes = document.querySelectorAll(selector)
    for (const el of nodes) {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) return el
    }
    return null
  }
  return document.querySelector(selector)
}

function measureTarget(selector, padding = DEFAULT_PADDING, mode = 'element') {
  const el = resolveTargetElement(selector)
  if (!el) return null

  const rect = el.getBoundingClientRect()
  if (rect.width < 1 && rect.height < 1) return null

  const isNavTarget = isNavBarTarget(selector)
  const topFloor = isNavTarget ? VIEWPORT_MARGIN : NAV_CLEARANCE

  if (mode === 'section') {
    const top = Math.max(NAV_CLEARANCE, rect.top - padding)
    const bottom = Math.min(window.innerHeight - VIEWPORT_MARGIN, rect.bottom + padding)
    const height = Math.max(160, bottom - top)
    const left = Math.max(VIEWPORT_MARGIN, rect.left - padding)
    const right = Math.min(window.innerWidth - VIEWPORT_MARGIN, rect.right + padding)
    return {
      top,
      left,
      width: Math.max(200, right - left),
      height,
    }
  }

  return {
    top: Math.max(topFloor, rect.top - padding),
    left: Math.max(VIEWPORT_MARGIN, rect.left - padding),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

function placeTooltip(rect, placement, tooltipSize) {
  const margin = 14
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (!rect) {
    return {
      top: Math.max(margin, vh * 0.22),
      left: Math.max(margin, (vw - Math.min(360, vw - margin * 2)) / 2),
    }
  }

  let top = rect.top + rect.height + margin
  let left = rect.left + (rect.width - tooltipSize.width) / 2

  const allowFlip = placement !== 'bottom' && placement !== 'top'
  if (placement === 'top' || (allowFlip && placement !== 'left' && placement !== 'right' && top + tooltipSize.height > vh - margin)) {
    top = rect.top - tooltipSize.height - margin
  }
  if (placement === 'left') {
    top = rect.top
    left = rect.left - tooltipSize.width - margin
  } else if (placement === 'right') {
    top = rect.top
    left = rect.left + rect.width + margin
  }

  const maxLeft = vw - tooltipSize.width - margin
  const maxTop = vh - tooltipSize.height - margin
  left = Math.min(Math.max(margin, left), maxLeft)
  top = Math.min(Math.max(margin, top), maxTop)
  return { top, left }
}

export default function PortalOnboardingTour({
  steps,
  stepIndex,
  onStepIndexChange,
  onClose,
  t,
}) {
  const step = steps[stepIndex]
  const tooltipRef = useRef(null)
  const [spot, setSpot] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const [ready, setReady] = useState(false)

  const updateGeometry = useCallback(() => {
    if (!step) return
    const nextSpot = measureTarget(
      step.target,
      step.padding ?? DEFAULT_PADDING,
      step.targetMode ?? 'element',
    )
    setSpot(nextSpot)
    const tooltipEl = tooltipRef.current
    const tooltipSize = tooltipEl
      ? { width: tooltipEl.offsetWidth, height: tooltipEl.offsetHeight }
      : { width: 320, height: 180 }
    setTooltipPos(placeTooltip(nextSpot, step.placement ?? 'bottom', tooltipSize))
  }, [step])

  useEffect(() => {
    if (!step) return undefined
    setReady(false)
    scrollToSection(step.scrollTo ?? null, step.scrollToTop)
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    const delay = step.scrollTo || step.scrollToTop ? (reduceMotion ? 200 : 900) : (reduceMotion ? 0 : 180)
    const timer = window.setTimeout(() => setReady(true), delay)
    const remeasure = step.scrollTo || step.scrollToTop
      ? window.setTimeout(() => updateGeometry(), delay + 350)
      : null
    return () => {
      window.clearTimeout(timer)
      if (remeasure) window.clearTimeout(remeasure)
    }
  }, [step, updateGeometry])

  useLayoutEffect(() => {
    if (!ready || !step) return undefined
    updateGeometry()
    const onReflow = () => updateGeometry()
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)
    return () => {
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [ready, step, stepIndex, updateGeometry])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!step) return null

  const isFirst = stepIndex === 0
  const isLast = stepIndex >= steps.length - 1
  const counter = t.onboarding_step_counter
    ?.replace('{current}', String(stepIndex + 1))
    ?.replace('{total}', String(steps.length))

  function goNext() {
    if (isLast) onClose(true)
    else onStepIndexChange(stepIndex + 1)
  }

  function goPrev() {
    if (!isFirst) onStepIndexChange(stepIndex - 1)
  }

  const shades = spot
    ? [
        { top: 0, left: 0, width: '100%', height: spot.top },
        { top: spot.top, left: 0, width: spot.left, height: spot.height },
        { top: spot.top, left: spot.left + spot.width, width: `calc(100% - ${spot.left + spot.width}px)`, height: spot.height },
        { top: spot.top + spot.height, left: 0, width: '100%', height: `calc(100% - ${spot.top + spot.height}px)` },
      ]
    : [{ top: 0, left: 0, width: '100%', height: '100%' }]

  return createPortal(
    <div className="portal-onboarding" role="dialog" aria-modal="true" aria-labelledby="portal-onboarding-title">
      {shades.map((panel, index) => (
        <button
          key={index}
          type="button"
          className="portal-onboarding-shade"
          style={panel}
          aria-label={t.onboarding_skip}
          onClick={() => onClose(false)}
        />
      ))}
      {spot ? (
        <div
          className={`portal-onboarding-hole${isNavBarTarget(step.target) ? ' portal-onboarding-hole--nav' : ''}`}
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
          }}
          aria-hidden="true"
        />
      ) : null}
      <div
        ref={tooltipRef}
        className={`portal-onboarding-card${ready ? ' is-ready' : ''}`}
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        {counter ? <p className="portal-onboarding-counter">{counter}</p> : null}
        <h2 id="portal-onboarding-title" className="portal-onboarding-title">{step.title}</h2>
        <p className="portal-onboarding-body">{step.body}</p>
        <div className="portal-onboarding-actions">
          <button type="button" className="portal-onboarding-skip" onClick={() => onClose(false)}>
            {t.onboarding_skip}
          </button>
          <div className="portal-onboarding-nav">
            {!isFirst ? (
              <button type="button" className="portal-onboarding-prev" onClick={goPrev}>
                {t.onboarding_prev}
              </button>
            ) : null}
            <button type="button" className="portal-onboarding-next" onClick={goNext}>
              {isLast ? t.onboarding_finish : t.onboarding_next}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
